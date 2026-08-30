-- FASE DE GRUPOS — reconstrucción desde cero (ver plan en el chat con
-- Camilo). El sorteo de partidos (quién juega contra quién, en qué
-- fecha) YA NO se calcula acá: se arma en JavaScript puro
-- (lib/fasesDeGrupos.mjs, con su propio test de estrés corrido y
-- verificado antes de escribir este archivo) y este patch solo se
-- encarga de guardar filas ya calculadas. Cero "random()" en este
-- archivo — esa fue la causa real de que la versión vieja mezclara
-- equipos de otro grupo en los cruces.
--
-- Por ahora, esta feature es SOLO PARA ADMIN (igual que "Ligas"): las
-- funciones de acá exigen is_admin() a secas, no "admin o dueño del
-- torneo" como el resto de la web. Cuando se decida abrirla a
-- cualquier organizador, alcanza con cambiar ese chequeo.
--
-- Requiere lo que ya está vivo en producción (columnas, generar_bracket,
-- entrelazar_por_seed, tope_de_partido/fase_de_partido) — no se toca
-- nada de eso acá, excepto declarar_ganador (ver más abajo, es un
-- arreglo real, no solo reordenar código).

-- ── Arreglo real encontrado al revisar declarar_ganador ──────────────
--
-- declarar_ganador asume que round_index + match_index arman un árbol
-- de eliminación único por bracket (para saber a qué partido de la
-- ronda siguiente avanza el ganador). Eso vale para 'main'/'repechaje'/
-- 'oro'/'plata', pero NO para 'grupos': ahí round_index es "fecha" (no
-- ronda de bracket) y varios grupos comparten el mismo bracket='grupos',
-- así que match_index se repite entre grupos distintos. Si se dejaba
-- correr la rama de "avanzar de ronda" para un partido de grupos, podía
-- pisar por error un partido de OTRO grupo que compartiera fecha+índice
-- — este es, con bastante certeza, uno de los bugs reales de la versión
-- vieja (no solo la volatilidad de random() que quedó documentada en su
-- momento). La versión anterior de declarar_ganador NUNCA tuvo un guard
-- para esto, ni siquiera en su primera versión (se revisó el historial
-- completo). Se agrega acá, antes de tocar nada de la fase de grupos
-- de vuelta.
create or replace function public.declarar_ganador(p_match_id uuid, p_winner_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  next_m matches%rowtype;
  max_round int;
  next_idx int;
  round0_done boolean;
  t_repechaje boolean;
  t_modo text;
  existing_rep int;
  losers uuid[];
  loser_id uuid;
begin
  select * into m from matches where id = p_match_id;
  if not found or m.winner_id is not null then return; end if;
  if p_winner_id is distinct from m.team1_id and p_winner_id is distinct from m.team2_id then
    raise exception 'ese equipo no juega este partido';
  end if;

  if auth.uid() is not null and not (
    public.is_admin() or exists (
      select 1 from tournaments t where t.id = m.tournament_id and t.organizador_id = auth.uid()
    )
  ) then
    raise exception 'no autorizado';
  end if;

  -- Partido de fase de grupos: no es un árbol de eliminación, cada
  -- cruce es independiente (no hay "próximo partido" al que avanzar ni
  -- campeón que declarar acá — eso lo hace cerrar_fase_grupos cuando
  -- termina toda la fase). Alcanza con guardar quién ganó.
  if m.bracket = 'grupos' then
    update matches set winner_id = p_winner_id where id = p_match_id;
    return;
  end if;

  update matches set winner_id = p_winner_id where id = p_match_id;

  select modo into t_modo from tournaments where id = m.tournament_id;

  -- Modo Vidón: el perdedor de la ronda 0 entra solo al próximo
  -- casillero vacío, por orden. El organizador puede cambiarlo después
  -- tocando directo en el cuadro (o saltar un casillero que ya no va a
  -- tener quién lo llene, ver saltar_casillero_vidon).
  if t_modo = 'vidon' and m.bracket = 'main' and m.round_index = 0 then
    loser_id := case when p_winner_id = m.team1_id then m.team2_id else m.team1_id end;
    if loser_id is not null then
      perform public.colocar_perdedor_vidon(m.tournament_id, m.id, loser_id);
    end if;
  end if;

  select max(round_index) into max_round from matches where tournament_id = m.tournament_id and bracket = m.bracket;

  if m.round_index = max_round then
    if m.bracket = 'main' then
      update tournaments set champion_id = p_winner_id where id = m.tournament_id;
    elsif m.bracket = 'repechaje' then
      update tournaments set repechaje_champion_id = p_winner_id where id = m.tournament_id;
    elsif m.bracket = 'oro' then
      update tournaments set campeon_oro_id = p_winner_id where id = m.tournament_id;
    elsif m.bracket = 'plata' then
      update tournaments set campeon_plata_id = p_winner_id where id = m.tournament_id;
    end if;
  else
    next_idx := m.match_index / 2;
    if m.match_index % 2 = 0 then
      update matches set team1_id = p_winner_id
        where tournament_id = m.tournament_id and bracket = m.bracket and round_index = m.round_index + 1 and match_index = next_idx;
    else
      update matches set team2_id = p_winner_id
        where tournament_id = m.tournament_id and bracket = m.bracket and round_index = m.round_index + 1 and match_index = next_idx;
    end if;

    -- Cascada de casillero saltado: si el partido de la ronda siguiente
    -- quedó marcado como bye (porque su otro origen se saltó a mano) y
    -- ahora, con este equipo, ya tiene exactamente uno solo, pasa
    -- directo sin esperar más.
    select * into next_m from matches
      where tournament_id = m.tournament_id and bracket = m.bracket and round_index = m.round_index + 1 and match_index = next_idx;
    if found and next_m.bye and next_m.winner_id is null
       and (next_m.team1_id is not null) <> (next_m.team2_id is not null) then
      perform public.declarar_ganador(next_m.id, coalesce(next_m.team1_id, next_m.team2_id));
    end if;
  end if;

  if t_modo = 'directa' and m.bracket = 'main' and m.round_index = 0 then
    select bool_and(winner_id is not null) into round0_done
      from matches where tournament_id = m.tournament_id and bracket = 'main' and round_index = 0;
    if round0_done then
      select repechaje into t_repechaje from tournaments where id = m.tournament_id;
      if t_repechaje then
        select count(*) into existing_rep from matches where tournament_id = m.tournament_id and bracket = 'repechaje';
        if existing_rep = 0 then
          select array_agg(case when team1_id = winner_id then team2_id else team1_id end)
            into losers
            from matches where tournament_id = m.tournament_id and bracket = 'main' and round_index = 0 and bye = false;
          if array_length(losers, 1) >= 2 then
            perform public.generar_bracket(m.tournament_id, 'repechaje', losers);
          elsif array_length(losers, 1) = 1 then
            update tournaments set repechaje_champion_id = losers[1] where id = m.tournament_id;
          end if;
        end if;
      end if;
    end if;
  end if;
end;
$$;
revoke execute on function public.declarar_ganador(uuid, uuid) from anon;
revoke execute on function public.declarar_ganador(uuid, uuid) from public;
grant execute on function public.declarar_ganador(uuid, uuid) to authenticated;

-- ── Armar la fase de grupos a partir de un fixture ya calculado en JS ──
-- p_asignacion: [{"team_id": "...", "grupo": 1}, ...]
-- p_fixture:    [{"grupo": 1, "fecha": 0, "team1_id": "...", "team2_id": "..."}, ...]
-- (salen de repartirEnGrupos()/armarFixtureGrupo() en lib/fasesDeGrupos.mjs)
create or replace function public.generar_fase_grupos_desde_fixture(
  p_tournament_id uuid, p_cantidad_grupos int, p_asignacion jsonb, p_fixture jsonb
) returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  jugados int;
  item jsonb;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  -- Bloquea la fila del torneo hasta que termine esta función — un
  -- segundo llamado simultáneo para el mismo torneo espera acá en vez
  -- de pisarse con este (mismo criterio que ya se usaba antes).
  perform 1 from tournaments where id = p_tournament_id for update;

  if p_cantidad_grupos < 1 then
    raise exception 'la cantidad de grupos tiene que ser al menos 1';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_asignacion) x
    where not exists (select 1 from teams tm where tm.id = (x->>'team_id')::uuid and tm.tournament_id = p_tournament_id)
  ) then
    raise exception 'algún equipo no pertenece a este torneo';
  end if;

  select count(*) into jugados from matches
    where tournament_id = p_tournament_id and bracket = 'grupos' and winner_id is not null;
  if jugados > 0 then
    raise exception 'ya hay partidos de grupos jugados — no se puede volver a sortear';
  end if;

  delete from matches where tournament_id = p_tournament_id and bracket = 'grupos';
  update teams set grupo = null where tournament_id = p_tournament_id;

  for item in select * from jsonb_array_elements(p_asignacion) loop
    update teams set grupo = (item->>'grupo')::int
      where id = (item->>'team_id')::uuid and tournament_id = p_tournament_id;
  end loop;

  -- match_index: numeración simple y única dentro de cada grupo+fecha
  -- (ya no hace falta que sea única entre grupos distintos — declarar_ganador
  -- ahora nunca usa match_index para nada en partidos de grupos).
  insert into matches (tournament_id, bracket, grupo, round_index, match_index, team1_id, team2_id, bye, match_token)
  select
    p_tournament_id,
    'grupos',
    (t.f->>'grupo')::int,
    (t.f->>'fecha')::int,
    (row_number() over (partition by (t.f->>'grupo')::int, (t.f->>'fecha')::int order by t.ord) - 1)::int,
    (t.f->>'team1_id')::uuid,
    (t.f->>'team2_id')::uuid,
    false,
    encode(gen_random_bytes(8), 'hex')
  from jsonb_array_elements(p_fixture) with ordinality as t(f, ord);

  update tournaments set
    formato = 'grupos',
    grupos_config = jsonb_set(coalesce(grupos_config, '{}'::jsonb), '{cantidad_grupos}', to_jsonb(p_cantidad_grupos)),
    grupos_generados = true
  where id = p_tournament_id;
end;
$$;
grant execute on function public.generar_fase_grupos_desde_fixture(uuid, int, jsonb, jsonb) to authenticated;
revoke execute on function public.generar_fase_grupos_desde_fixture(uuid, int, jsonb, jsonb) from anon;
revoke execute on function public.generar_fase_grupos_desde_fixture(uuid, int, jsonb, jsonb) from public;

-- ── Equipo tardío: se suma al grupo con menos equipos, sin resortear
-- nada del resto. Esto SÍ se arma entero acá (no en JS): es un solo
-- equipo contra sus compañeros ya anotados, no hay ningún random() de
-- por medio, así que no tiene el problema que tenía el sorteo general. ──
create or replace function public.agregar_tardio_grupo(p_tournament_id uuid, p_team_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  t tournaments%rowtype;
  grupo_destino int;
  companero record;
  siguiente_round int;
  idx int := 0;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  select * into t from tournaments where id = p_tournament_id for update;
  if not found then raise exception 'torneo no encontrado'; end if;
  if t.formato is distinct from 'grupos' or not t.grupos_generados then
    raise exception 'este torneo no tiene una fase de grupos armada';
  end if;
  if t.copas_generadas then raise exception 'la fase de grupos ya se cerró'; end if;

  if not exists (select 1 from teams where id = p_team_id and tournament_id = p_tournament_id) then
    raise exception 'ese equipo no pertenece a este torneo';
  end if;

  if exists (select 1 from teams where id = p_team_id and grupo is not null) then
    return; -- ya está en un grupo, no hay nada que hacer
  end if;

  select grupo into grupo_destino
    from teams where tournament_id = p_tournament_id and grupo is not null
    group by grupo
    order by count(*) asc, grupo asc
    limit 1;

  if grupo_destino is null then
    raise exception 'no se encontró a qué grupo sumarlo';
  end if;

  update teams set grupo = grupo_destino where id = p_team_id;

  select coalesce(max(round_index), -1) + 1 into siguiente_round
    from matches where tournament_id = p_tournament_id and bracket = 'grupos' and grupo = grupo_destino;

  for companero in
    select id from teams
    where tournament_id = p_tournament_id and grupo = grupo_destino and id <> p_team_id
  loop
    insert into matches (tournament_id, bracket, grupo, round_index, match_index, team1_id, team2_id, bye, match_token)
    values (p_tournament_id, 'grupos', grupo_destino, siguiente_round, idx, p_team_id, companero.id, false, encode(gen_random_bytes(8), 'hex'));
    idx := idx + 1;
  end loop;
end;
$$;
grant execute on function public.agregar_tardio_grupo(uuid, uuid) to authenticated;
revoke execute on function public.agregar_tardio_grupo(uuid, uuid) from anon;
revoke execute on function public.agregar_tardio_grupo(uuid, uuid) from public;

-- ── Cargar resultado de un partido de grupos a mano (con puntaje real,
-- hace falta para la diferencia de tantos). Reutiliza declarar_ganador,
-- que ya sabe (ver el arreglo de arriba) que un partido de 'grupos' es
-- un caso aparte y no debe tocar nada más que winner_id. ──
create or replace function public.cargar_resultado_grupo(p_match_id uuid, p_score_a int, p_score_b int)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  tope int;
  ganador uuid;
begin
  select * into m from matches where id = p_match_id;
  if not found or m.bracket != 'grupos' then
    raise exception 'ese partido no es de la fase de grupos';
  end if;

  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  if m.winner_id is not null then
    raise exception 'ese partido ya está cerrado';
  end if;

  tope := public.tope_de_partido(p_match_id);
  if p_score_a < 0 or p_score_a > tope or p_score_b < 0 or p_score_b > tope then
    raise exception 'los puntos van de 0 a %', tope;
  end if;
  if p_score_a = p_score_b then
    raise exception 'en truco no hay empates';
  end if;

  ganador := case when p_score_a > p_score_b then m.team1_id else m.team2_id end;
  update matches set score_a = p_score_a, score_b = p_score_b where id = p_match_id;
  perform public.declarar_ganador(p_match_id, ganador);
end;
$$;
grant execute on function public.cargar_resultado_grupo(uuid, int, int) to authenticated;
revoke execute on function public.cargar_resultado_grupo(uuid, int, int) from anon, public;

-- ── Reabrir un partido de grupos: no hay "próximo partido" al que
-- afecte, así que solo se limpia. Si ya se armaron las copas con esa
-- fase, no se deja (la clasificación ya se pudo haber usado). ──
create or replace function public.reabrir_partido_grupo(p_match_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  t tournaments%rowtype;
begin
  select * into m from matches where id = p_match_id;
  if not found or m.bracket != 'grupos' then raise exception 'ese partido no es de la fase de grupos'; end if;

  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  select * into t from tournaments where id = m.tournament_id;

  if t.copas_generadas then
    raise exception 'ya se armaron las copas con esta fase de grupos — no se puede reabrir sin desarmarlas antes';
  end if;

  update matches set winner_id = null, score_a = 0, score_b = 0 where id = m.id;
end;
$$;
grant execute on function public.reabrir_partido_grupo(uuid) to authenticated;
revoke execute on function public.reabrir_partido_grupo(uuid) from anon;
revoke execute on function public.reabrir_partido_grupo(uuid) from public;

-- ── Cerrar la fase de grupos: arma Copa de Oro (obligatoria) y, si se
-- pasa, Copa de Plata — con los equipos YA rankeados y YA elegidos
-- desde la pantalla (rankearGrupo()/rankearGlobal() de
-- lib/fasesDeGrupos.mjs, la misma lógica ya probada). Acá no se
-- recalcula ninguna tabla de posiciones — solo se valida y se arma el
-- cuadro, reutilizando generar_bracket + entrelazar_por_seed tal cual
-- existían. p_equipos_oro/p_equipos_plata van del mejor al peor. ──
create or replace function public.cerrar_fase_grupos(
  p_tournament_id uuid, p_equipos_oro uuid[], p_equipos_plata uuid[] default null
) returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  pendientes int;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  perform 1 from tournaments where id = p_tournament_id for update;

  select count(*) into pendientes from matches
    where tournament_id = p_tournament_id and bracket = 'grupos' and winner_id is null;
  if pendientes > 0 then
    raise exception 'todavía faltan % partido(s) de la fase de grupos', pendientes;
  end if;

  if exists (
    select 1 from matches where tournament_id = p_tournament_id and bracket in ('oro', 'plata') and winner_id is not null
  ) then
    raise exception 'ya hay partidos jugados en las copas — no se pueden volver a generar';
  end if;

  if coalesce(array_length(p_equipos_oro, 1), 0) < 2 then
    raise exception 'la Copa de Oro necesita al menos 2 equipos';
  end if;
  if p_equipos_plata is not null and coalesce(array_length(p_equipos_plata, 1), 0) < 2 then
    raise exception 'la Copa de Plata necesita al menos 2 equipos';
  end if;

  if exists (
    select 1 from unnest(p_equipos_oro) a(id)
    join unnest(coalesce(p_equipos_plata, array[]::uuid[])) b(id) using (id)
  ) then
    raise exception 'un mismo equipo no puede estar en las dos copas a la vez';
  end if;

  if exists (
    select 1 from unnest(p_equipos_oro || coalesce(p_equipos_plata, array[]::uuid[])) tid
    where not exists (select 1 from teams tm where tm.id = tid and tm.tournament_id = p_tournament_id)
  ) then
    raise exception 'algún equipo no pertenece a este torneo';
  end if;

  delete from matches where tournament_id = p_tournament_id and bracket in ('oro', 'plata');
  update tournaments set campeon_oro_id = null, campeon_plata_id = null where id = p_tournament_id;

  perform public.generar_bracket(p_tournament_id, 'oro', public.entrelazar_por_seed(p_equipos_oro), false);

  if p_equipos_plata is not null then
    perform public.generar_bracket(p_tournament_id, 'plata', public.entrelazar_por_seed(p_equipos_plata), false);
  end if;

  update tournaments set copas_generadas = true where id = p_tournament_id;
end;
$$;
grant execute on function public.cerrar_fase_grupos(uuid, uuid[], uuid[]) to authenticated;
revoke execute on function public.cerrar_fase_grupos(uuid, uuid[], uuid[]) from anon;
revoke execute on function public.cerrar_fase_grupos(uuid, uuid[], uuid[]) from public;

-- ── Volver a "Sorteo normal" desde una fase de grupos, mientras nadie
-- jugó nada todavía — mismo criterio que volverACuadroDirecto ya tiene
-- para clasificatoria. ──
create or replace function public.deshacer_fase_grupos(p_tournament_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  jugados int;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  perform 1 from tournaments where id = p_tournament_id for update;

  select count(*) into jugados from matches
    where tournament_id = p_tournament_id and bracket = 'grupos' and winner_id is not null;
  if jugados > 0 then
    raise exception 'ya se jugó algo de la fase de grupos — no se puede deshacer';
  end if;

  delete from matches where tournament_id = p_tournament_id and bracket in ('grupos', 'oro', 'plata');
  update teams set grupo = null where tournament_id = p_tournament_id;
  update tournaments set
    formato = 'directa',
    grupos_generados = false,
    copas_generadas = false,
    campeon_oro_id = null,
    campeon_plata_id = null
  where id = p_tournament_id;
end;
$$;
grant execute on function public.deshacer_fase_grupos(uuid) to authenticated;
revoke execute on function public.deshacer_fase_grupos(uuid) from anon;
revoke execute on function public.deshacer_fase_grupos(uuid) from public;
