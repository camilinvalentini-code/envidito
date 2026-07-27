-- MODO GRUPOS — base de datos.
--
-- Esto es la primera mitad de la funcionalidad (la lógica y los datos).
-- La pantalla para armarlo y verlo desde la web viene en un paso aparte.
--
-- Cómo queda pensado, en criollo:
--   1) El organizador arma N grupos, la web sortea el fixture (todos
--      contra todos dentro de cada grupo) sola.
--   2) Se juegan los partidos de grupos con el mismo anotador de
--      siempre (marcador, código por equipo, todo igual).
--   3) Cuando terminan todos los partidos de grupos, el organizador
--      cierra la fase — según reglas configurables por posición (ej:
--      "1° y 2° de cada grupo van a Copa de Oro", "3° puesto: los 4
--      mejores de todos los grupos van a Oro, el resto a Plata"), la
--      web arma automáticamente hasta 2 copas de eliminación directa
--      (reutilizando el mismo generador de cuadro que ya existe).
--   4) Cada copa se juega y se seguí igual que cualquier cuadro de hoy.

-- ── Columnas nuevas ──────────────────────────────────────────────────

alter table tournaments add column if not exists formato text not null default 'directa' check (formato in ('directa', 'grupos'));
alter table tournaments add column if not exists grupos_config jsonb not null default '{}'::jsonb;
alter table tournaments add column if not exists campeon_oro_id uuid references teams(id);
alter table tournaments add column if not exists campeon_plata_id uuid references teams(id);
alter table tournaments add column if not exists grupos_generados boolean not null default false;
alter table tournaments add column if not exists copas_generadas boolean not null default false;

alter table teams add column if not exists grupo int;

alter table matches add column if not exists grupo int;
alter table matches drop constraint if exists matches_bracket_check;
alter table matches add constraint matches_bracket_check check (bracket in ('main', 'repechaje', 'grupos', 'oro', 'plata'));

-- grupos_config queda con esta forma (un solo campo jsonb, para no
-- llenar de tablas algo que en el fondo es config):
-- {
--   "cantidad_grupos": 6,
--   "reglas": [
--     {"posicion": 1, "destino": "oro"},
--     {"posicion": 2, "destino": "oro"},
--     {"posicion": 3, "tipo": "split", "cantidad_top": 4, "destino_top": "oro", "destino_resto": "plata"},
--     {"posicion": 4, "destino": "plata"}
--   ],
--   "puntos_por_fase": {"grupos": 24, "octavos": 24, "cuartos": 24, "semifinal": 30, "final": 30}
-- }

-- ── En qué fase está un partido, y a cuántos puntos se juega ───────────
-- (para torneos formato='directa' sigue funcionando exactamente igual
-- que hasta ahora: usa tournaments.puntos_max, sin tocar nada de eso.)

create or replace function public.fase_de_partido(p_match_id uuid)
returns text language plpgsql stable as $$
declare
  m matches%rowtype;
  max_round int;
  faltan int;
  nombres text[] := array['final', 'semifinal', 'cuartos', 'octavos', 'dieciseisavos', 'treintaydosavos'];
begin
  select * into m from matches where id = p_match_id;
  if not found then return null; end if;
  if m.bracket = 'grupos' then return 'grupos'; end if;
  if m.bracket not in ('oro', 'plata') then return null; end if;

  select max(round_index) into max_round from matches where tournament_id = m.tournament_id and bracket = m.bracket;
  faltan := max_round - m.round_index;
  if faltan >= 0 and faltan < array_length(nombres, 1) then
    return nombres[faltan + 1];
  else
    return 'ronda ' || (m.round_index + 1);
  end if;
end;
$$;

create or replace function public.tope_de_partido(p_match_id uuid)
returns int language plpgsql stable as $$
declare
  m matches%rowtype;
  t tournaments%rowtype;
  v_fase text;
  v_tope int;
begin
  select * into m from matches where id = p_match_id;
  if not found then return 30; end if;
  select * into t from tournaments where id = m.tournament_id;

  if t.formato = 'grupos' then
    v_fase := public.fase_de_partido(m.id);
    v_tope := (t.grupos_config -> 'puntos_por_fase' ->> v_fase)::int;
  end if;

  return coalesce(v_tope, t.puntos_max, 30);
end;
$$;

-- Se expone (a diferencia de los otros helpers) porque el anotador la
-- necesita para saber a cuántos puntos se juega ANTES de tocar ningún
-- botón. No revela nada sensible, solo un número.
grant execute on function public.tope_de_partido(uuid) to anon, authenticated;

-- ── anotar_punto / proponer_cierre / confirmar_cierre ────────────────
-- Mismo código de equipo que ya existe, solo cambia de dónde sacan el
-- tope: antes siempre tournaments.puntos_max, ahora tope_de_partido()
-- (que en modo 'directa' termina devolviendo lo mismo de antes).

create or replace function public.anotar_punto(p_match_token text, p_lado text, p_delta int, p_codigo text)
returns matches language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  nuevo int;
  tope int;
begin
  select * into m from matches where match_token = p_match_token;
  if not found then raise exception 'partido no encontrado'; end if;
  if not public.codigo_valido(m.id, p_codigo) then raise exception 'código inválido'; end if;
  if m.winner_id is not null then return m; end if;

  tope := public.tope_de_partido(m.id);

  if p_lado = 'A' then
    nuevo := greatest(0, least(tope, m.score_a + p_delta));
    update matches set score_a = nuevo where id = m.id;
  else
    nuevo := greatest(0, least(tope, m.score_b + p_delta));
    update matches set score_b = nuevo where id = m.id;
  end if;

  if nuevo >= tope then
    perform public.declarar_ganador(m.id, case when p_lado = 'A' then m.team1_id else m.team2_id end);
  end if;

  select * into m from matches where id = m.id;
  return m;
end;
$$;
grant execute on function public.anotar_punto(text, text, int, text) to anon, authenticated;

create or replace function public.proponer_cierre(p_match_token text, p_lado text, p_codigo text)
returns matches language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
begin
  select * into m from matches where match_token = p_match_token;
  if not found then raise exception 'partido no encontrado'; end if;
  if not public.codigo_valido(m.id, p_codigo) then raise exception 'código inválido'; end if;
  if m.winner_id is not null then return m; end if;
  update matches set confirmacion_pendiente = true, lado_propuesto = p_lado, confirmaciones = 1 where id = m.id;
  select * into m from matches where id = m.id;
  return m;
end;
$$;
grant execute on function public.proponer_cierre(text, text, text) to anon, authenticated;

create or replace function public.confirmar_cierre(p_match_token text, p_codigo text)
returns matches language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  tope int;
  ganador uuid;
begin
  select * into m from matches where match_token = p_match_token;
  if not found then raise exception 'partido no encontrado'; end if;
  if not public.codigo_valido(m.id, p_codigo) then raise exception 'código inválido'; end if;
  if m.winner_id is not null then return m; end if;
  if not m.confirmacion_pendiente then return m; end if;

  update matches set confirmaciones = confirmaciones + 1 where id = m.id;
  select * into m from matches where id = m.id;

  if m.confirmaciones < 2 then
    return m;
  end if;

  tope := public.tope_de_partido(m.id);

  if m.lado_propuesto = 'A' then
    update matches set score_a = tope, confirmacion_pendiente = false, lado_propuesto = null where id = m.id;
    ganador := m.team1_id;
  else
    update matches set score_b = tope, confirmacion_pendiente = false, lado_propuesto = null where id = m.id;
    ganador := m.team2_id;
  end if;

  perform public.declarar_ganador(m.id, ganador);

  select * into m from matches where id = m.id;
  return m;
end;
$$;
grant execute on function public.confirmar_cierre(text, text) to anon, authenticated;

-- ── generar_bracket: sumamos la opción de NO mezclar al azar ─────────
-- Hacía falta para las copas del modo grupos: los clasificados tienen
-- que entrar ordenados según cómo quedaron en la fase de grupos, no
-- mezclados. El parámetro nuevo tiene default, para que los llamados
-- viejos (sorteo normal, repechaje, Vidon) sigan funcionando igual que
-- siempre — pero hay que borrar la versión de 3 parámetros primero, o
-- Postgres se queda con las dos a la vez y no sabe cuál usar cuando se
-- la llama con 3 (quedaría "ambigua").

drop function if exists public.generar_bracket(uuid, text, uuid[]);

create or replace function public.generar_bracket(
  p_tournament_id uuid, p_bracket text, p_team_ids uuid[], p_shuffle boolean default true
) returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  n int := array_length(p_team_ids, 1);
  size int := 2;
  num_matches0 int;
  byes int;
  shuffled uuid[];
  sizes int[];
  team1_usado uuid[] := array[]::uuid[];
  idx int := 1;
  i int;
  r int;
  num_rounds int;
  rows_this_round int;
  t1 uuid; t2 uuid; is_bye boolean;
  next_idx int; slot text;
begin
  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments t where t.id = p_tournament_id and t.organizador_id = auth.uid())
  ) then
    raise exception 'no autorizado';
  end if;

  while size < n loop size := size * 2; end loop;
  num_matches0 := size / 2;
  byes := size - n;

  if p_shuffle then
    select array_agg(x order by random()) into shuffled from unnest(p_team_ids) x;
  else
    shuffled := p_team_ids;
  end if;

  select array_agg(v order by random()) into sizes from (
    select 1 as v from generate_series(1, byes)
    union all
    select 2 as v from generate_series(1, num_matches0 - byes)
  ) s;

  for i in 1..num_matches0 loop
    t1 := shuffled[idx]; idx := idx + 1;
    is_bye := sizes[i] = 1;
    if is_bye then t2 := null; else t2 := shuffled[idx]; idx := idx + 1; end if;
    team1_usado := array_append(team1_usado, t1);
    insert into matches (tournament_id, bracket, round_index, match_index, team1_id, team2_id, winner_id, bye, match_token)
    values (p_tournament_id, p_bracket, 0, i - 1, t1, t2, case when is_bye then t1 else null end, is_bye,
            case when is_bye then null else encode(gen_random_bytes(8), 'hex') end);
  end loop;

  num_rounds := 0;
  while (size >> num_rounds) > 1 loop num_rounds := num_rounds + 1; end loop;

  for r in 1..num_rounds - 1 loop
    rows_this_round := size / power(2, r + 1);
    for i in 0..rows_this_round - 1 loop
      insert into matches (tournament_id, bracket, round_index, match_index, team1_id, team2_id, bye, match_token)
      values (p_tournament_id, p_bracket, r, i, null, null, false, encode(gen_random_bytes(8), 'hex'));
    end loop;
  end loop;

  for i in 0..num_matches0 - 1 loop
    if sizes[i + 1] = 1 then
      next_idx := i / 2;
      slot := case when i % 2 = 0 then 'team1_id' else 'team2_id' end;
      if slot = 'team1_id' then
        update matches set team1_id = team1_usado[i + 1]
          where tournament_id = p_tournament_id and bracket = p_bracket and round_index = 1 and match_index = next_idx;
      else
        update matches set team2_id = team1_usado[i + 1]
          where tournament_id = p_tournament_id and bracket = p_bracket and round_index = 1 and match_index = next_idx;
      end if;
    end if;
  end loop;
end;
$$;
revoke execute on function public.generar_bracket(uuid, text, uuid[], boolean) from anon;
revoke execute on function public.generar_bracket(uuid, text, uuid[], boolean) from public;
grant execute on function public.generar_bracket(uuid, text, uuid[], boolean) to authenticated;

-- ── declarar_ganador / reabrir_cascada: sumar 'oro' y 'plata' ────────
-- Todo lo demás (avance de ronda, propagación de libres) ya funcionaba
-- para cualquier bracket sin importar el nombre — solo hacía falta
-- decirle en qué campo guardar el campeón cuando el bracket es 'oro' o
-- 'plata' en vez de 'main'/'repechaje'.

create or replace function public.declarar_ganador(p_match_id uuid, p_winner_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  max_round int;
  next_idx int;
  round0_done boolean;
  t_repechaje boolean;
  existing_rep int;
  losers uuid[];
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

  update matches set winner_id = p_winner_id where id = p_match_id;

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
  end if;

  if m.bracket = 'main' and m.round_index = 0 then
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

create or replace function public.reabrir_cascada(p_match_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  max_round int;
  next_idx int;
  siguiente matches%rowtype;
begin
  select * into m from matches where id = p_match_id;
  if not found then return; end if;

  if m.bracket = 'grupos' then
    raise exception 'para un partido de la fase de grupos, usá reabrir_partido_grupo';
  end if;

  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments t where t.id = m.tournament_id and t.organizador_id = auth.uid())
  ) then
    raise exception 'no autorizado';
  end if;

  if m.winner_id is null then return; end if;

  select max(round_index) into max_round from matches where tournament_id = m.tournament_id and bracket = m.bracket;

  if m.round_index = max_round then
    if m.bracket = 'main' then
      update tournaments set champion_id = null where id = m.tournament_id;
    elsif m.bracket = 'repechaje' then
      update tournaments set repechaje_champion_id = null where id = m.tournament_id;
    elsif m.bracket = 'oro' then
      update tournaments set campeon_oro_id = null where id = m.tournament_id;
    elsif m.bracket = 'plata' then
      update tournaments set campeon_plata_id = null where id = m.tournament_id;
    end if;
  else
    next_idx := m.match_index / 2;
    select * into siguiente from matches
      where tournament_id = m.tournament_id and bracket = m.bracket and round_index = m.round_index + 1 and match_index = next_idx;

    if found and siguiente.winner_id is not null then
      perform public.reabrir_cascada(siguiente.id);
    end if;

    if found then
      if m.match_index % 2 = 0 then
        update matches set team1_id = null where id = siguiente.id;
      else
        update matches set team2_id = null where id = siguiente.id;
      end if;
    end if;
  end if;

  update matches set winner_id = null where id = m.id;
end;
$$;
grant execute on function public.reabrir_cascada(uuid) to authenticated;
revoke execute on function public.reabrir_cascada(uuid) from anon;
revoke execute on function public.reabrir_cascada(uuid) from public;

-- Reabrir un partido de grupos es más simple: no hay "siguiente
-- partido" al que afecte (los resultados de grupos solo importan para
-- la tabla, no para otro partido puntual) — así que solo se limpia. Si
-- ya se armaron las copas con esa fase de grupos, no se deja, porque la
-- clasificación ya pudo haberse usado.
create or replace function public.reabrir_partido_grupo(p_match_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  t tournaments%rowtype;
begin
  select * into m from matches where id = p_match_id;
  if not found or m.bracket != 'grupos' then raise exception 'ese partido no es de la fase de grupos'; end if;

  select * into t from tournaments where id = m.tournament_id;
  if auth.uid() is not null and not (
    public.is_admin() or t.organizador_id = auth.uid()
  ) then
    raise exception 'no autorizado';
  end if;

  if t.copas_generadas then
    raise exception 'ya se armaron las copas con esta fase de grupos — no se puede reabrir sin desarmarlas antes';
  end if;

  update matches set winner_id = null, score_a = 0, score_b = 0 where id = m.id;
end;
$$;
grant execute on function public.reabrir_partido_grupo(uuid) to authenticated;
revoke execute on function public.reabrir_partido_grupo(uuid) from anon;
revoke execute on function public.reabrir_partido_grupo(uuid) from public;

-- ── Armar los grupos + el fixture (todos contra todos) ───────────────

create or replace function public.generar_fase_grupos(p_tournament_id uuid, p_cantidad_grupos int)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  jugados int;
  equipos uuid[];
  n int;
  i int;
  g record;
  grupo_equipos uuid[];
  n_grupo int;
  ronda int;
  mitad int;
  t1 uuid;
  t2 uuid;
  match_idx int;
begin
  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments t where t.id = p_tournament_id and t.organizador_id = auth.uid())
  ) then
    raise exception 'no autorizado';
  end if;

  if p_cantidad_grupos < 1 then
    raise exception 'la cantidad de grupos tiene que ser al menos 1';
  end if;

  select count(*) into jugados from matches
    where tournament_id = p_tournament_id and bracket = 'grupos' and winner_id is not null;
  if jugados > 0 then
    raise exception 'ya hay partidos de grupos jugados — no se puede volver a sortear';
  end if;

  delete from matches where tournament_id = p_tournament_id and bracket = 'grupos';
  update teams set grupo = null where tournament_id = p_tournament_id;

  select array_agg(id order by random()) into equipos from teams where tournament_id = p_tournament_id;
  n := coalesce(array_length(equipos, 1), 0);
  if n < p_cantidad_grupos * 2 then
    raise exception 'hacen falta al menos % equipos para % grupos', p_cantidad_grupos * 2, p_cantidad_grupos;
  end if;

  for i in 1..n loop
    update teams set grupo = ((i - 1) % p_cantidad_grupos) + 1 where id = equipos[i];
  end loop;

  for g in
    select grupo, array_agg(id order by random()) as ids
    from teams where tournament_id = p_tournament_id and grupo is not null
    group by grupo
  loop
    grupo_equipos := g.ids;
    n_grupo := array_length(grupo_equipos, 1);
    if n_grupo % 2 = 1 then
      grupo_equipos := array_append(grupo_equipos, null);
      n_grupo := n_grupo + 1;
    end if;
    mitad := n_grupo / 2;

    for ronda in 0..n_grupo - 2 loop
      match_idx := 0;
      for i in 0..mitad - 1 loop
        t1 := grupo_equipos[i + 1];
        t2 := grupo_equipos[n_grupo - i];
        if t1 is not null and t2 is not null then
          insert into matches (tournament_id, bracket, grupo, round_index, match_index, team1_id, team2_id, bye, match_token)
          values (p_tournament_id, 'grupos', g.grupo, ronda, match_idx, t1, t2, false, encode(gen_random_bytes(8), 'hex'));
          match_idx := match_idx + 1;
        end if;
      end loop;
      if n_grupo > 2 then
        grupo_equipos := array[grupo_equipos[1]] || grupo_equipos[n_grupo:n_grupo] || grupo_equipos[2:n_grupo - 1];
      end if;
    end loop;
  end loop;

  update tournaments set
    formato = 'grupos',
    grupos_config = jsonb_set(coalesce(grupos_config, '{}'::jsonb), '{cantidad_grupos}', to_jsonb(p_cantidad_grupos)),
    grupos_generados = true
  where id = p_tournament_id;
end;
$$;
grant execute on function public.generar_fase_grupos(uuid, int) to authenticated;
revoke execute on function public.generar_fase_grupos(uuid, int) from anon;
revoke execute on function public.generar_fase_grupos(uuid, int) from public;

-- ── Cerrar la fase de grupos y armar las copas ───────────────────────

create or replace function public.entrelazar_por_seed(p_ordenados uuid[])
returns uuid[] language plpgsql as $$
declare
  l int := coalesce(array_length(p_ordenados, 1), 0);
  resultado uuid[] := array[]::uuid[];
  k int;
begin
  if l = 0 then return resultado; end if;
  for k in 1..ceil(l / 2.0)::int loop
    resultado := array_append(resultado, p_ordenados[k]);
    if l - k + 1 > k then
      resultado := array_append(resultado, p_ordenados[l - k + 1]);
    end if;
  end loop;
  return resultado;
end;
$$;

create or replace function public.generar_copas(p_tournament_id uuid, p_shuffle boolean default false)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  t tournaments%rowtype;
  pendientes int;
  rule jsonb;
  equipos_oro uuid[];
  equipos_plata uuid[];
begin
  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments tt where tt.id = p_tournament_id and tt.organizador_id = auth.uid())
  ) then
    raise exception 'no autorizado';
  end if;

  select * into t from tournaments where id = p_tournament_id;
  if not found then raise exception 'torneo no encontrado'; end if;

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

  delete from matches where tournament_id = p_tournament_id and bracket in ('oro', 'plata');
  update tournaments set campeon_oro_id = null, campeon_plata_id = null where id = p_tournament_id;

  create temporary table clasif on commit drop as
  with resultados as (
    select
      tm.id as team_id,
      tm.grupo,
      count(*) filter (where mt.winner_id = tm.id) as pg,
      coalesce(sum(case when mt.team1_id = tm.id then mt.score_a when mt.team2_id = tm.id then mt.score_b end), 0) as pf,
      coalesce(sum(case when mt.team1_id = tm.id then mt.score_b when mt.team2_id = tm.id then mt.score_a end), 0) as pc
    from teams tm
    left join matches mt on mt.tournament_id = tm.tournament_id and mt.bracket = 'grupos' and mt.grupo = tm.grupo
      and mt.winner_id is not null and (mt.team1_id = tm.id or mt.team2_id = tm.id)
    where tm.tournament_id = p_tournament_id and tm.grupo is not null
    group by tm.id, tm.grupo
  )
  select team_id, grupo, pg, (pf - pc) as dif,
    row_number() over (partition by grupo order by pg desc, (pf - pc) desc) as posicion,
    null::text as destino
  from resultados;

  for rule in select jsonb_array_elements(coalesce(t.grupos_config -> 'reglas', '[]'::jsonb)) loop
    if (rule ->> 'tipo') = 'split' then
      with candidatos as (
        select team_id, row_number() over (order by pg desc, dif desc) as rk
        from clasif where posicion = (rule ->> 'posicion')::int
      )
      update clasif set destino = case
          when candidatos.rk <= (rule ->> 'cantidad_top')::int then rule ->> 'destino_top'
          else rule ->> 'destino_resto'
        end
      from candidatos where clasif.team_id = candidatos.team_id;
    else
      update clasif set destino = rule ->> 'destino'
        where posicion = (rule ->> 'posicion')::int;
    end if;
  end loop;

  select array_agg(team_id order by pg desc, dif desc) into equipos_oro from clasif where destino = 'oro';
  select array_agg(team_id order by pg desc, dif desc) into equipos_plata from clasif where destino = 'plata';

  if equipos_oro is not null and array_length(equipos_oro, 1) >= 2 then
    if p_shuffle then
      perform public.generar_bracket(p_tournament_id, 'oro', equipos_oro, true);
    else
      perform public.generar_bracket(p_tournament_id, 'oro', public.entrelazar_por_seed(equipos_oro), false);
    end if;
  end if;

  if equipos_plata is not null and array_length(equipos_plata, 1) >= 2 then
    if p_shuffle then
      perform public.generar_bracket(p_tournament_id, 'plata', equipos_plata, true);
    else
      perform public.generar_bracket(p_tournament_id, 'plata', public.entrelazar_por_seed(equipos_plata), false);
    end if;
  end if;

  update tournaments set copas_generadas = true where id = p_tournament_id;
end;
$$;
grant execute on function public.generar_copas(uuid, boolean) to authenticated;
revoke execute on function public.generar_copas(uuid, boolean) from anon;
revoke execute on function public.generar_copas(uuid, boolean) from public;
