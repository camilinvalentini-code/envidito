-- Candado contra doble-toque en las funciones de fase de grupos.
--
-- La corrupción que se venía viendo (equipos de otro grupo mezclados
-- en los cruces, partidos de menos) NO era un error de matemática en
-- el sorteo — el método de Berger está bien. Era esto: si "Armar fase
-- de grupos" se toca dos veces seguidas (muy fácil con mal wifi: se
-- toca, no se ve respuesta al toque, se vuelve a tocar), se disparan
-- dos armados en simultáneo para el mismo torneo. El segundo pisa la
-- asignación de grupos del primero a mitad de camino — pero el primero
-- ya había insertado sus partidos con la asignación vieja, y esos
-- partidos quedan pegados en la tabla sin que nadie los borre, mezclados
-- con los del segundo armado. El botón deshabilitado mientras carga
-- (ya agregado en el panel) ayuda, pero no alcanza: si la página se
-- recarga entre los dos toques, ese estado se pierde.
--
-- El arreglo real es a nivel de base de datos: bloquear la fila del
-- torneo (select ... for update) apenas arranca cada una de estas
-- funciones, así un segundo llamado para el MISMO torneo tiene que
-- esperar a que el primero termine (se confirme) antes de empezar el
-- suyo — nunca corren pisándose.
--
-- Requiere haber corrido antes supabase-patch-fixture-grupos-berger.sql,
-- supabase-patch-mejores-terceros.sql y supabase-patch-tardio-grupo.sql.

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
  n_real int;
  ronda int;
  mitad int;
  idx_a int;
  idx_b int;
  pos_a int;
  pos_b int;
  t1 uuid;
  t2 uuid;
  match_idx int;
  esperados int;
  creados int;
begin
  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments t where t.id = p_tournament_id and t.organizador_id = auth.uid())
  ) then
    raise exception 'no autorizado';
  end if;

  -- Bloquea la fila del torneo hasta que termine esta función (commit o
  -- rollback) — un segundo llamado simultáneo para el mismo torneo
  -- espera acá en vez de pisarse con este.
  perform 1 from tournaments where id = p_tournament_id for update;

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

  select array_agg(id order by random()) into equipos
    from teams where tournament_id = p_tournament_id and not pendiente_aprobacion;
  n := coalesce(array_length(equipos, 1), 0);
  if n < p_cantidad_grupos * 2 then
    raise exception 'hacen falta al menos % equipos aprobados para % grupos', p_cantidad_grupos * 2, p_cantidad_grupos;
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
    n_real := array_length(grupo_equipos, 1);
    n_grupo := n_real;
    if n_grupo % 2 = 1 then
      grupo_equipos := array_append(grupo_equipos, null);
      n_grupo := n_grupo + 1;
    end if;
    mitad := n_grupo / 2;
    creados := 0;

    for ronda in 0..n_grupo - 2 loop
      match_idx := 0;
      for i in 0..mitad - 1 loop
        if i = 0 then
          pos_a := n_grupo;
          pos_b := ronda + 1;
        else
          idx_a := (ronda + i) % (n_grupo - 1);
          idx_b := (ronda - i + (n_grupo - 1)) % (n_grupo - 1);
          pos_a := idx_a + 1;
          pos_b := idx_b + 1;
        end if;
        t1 := grupo_equipos[pos_a];
        t2 := grupo_equipos[pos_b];
        if t1 is not null and t2 is not null then
          if t1 = t2 then
            raise exception 'error armando el grupo % (equipo repetido contra sí mismo) — avisale a Camilo', g.grupo;
          end if;
          insert into matches (tournament_id, bracket, grupo, round_index, match_index, team1_id, team2_id, bye, match_token)
          values (p_tournament_id, 'grupos', g.grupo, ronda, match_idx, t1, t2, false, encode(gen_random_bytes(8), 'hex'));
          match_idx := match_idx + 1;
          creados := creados + 1;
        end if;
      end loop;
    end loop;

    esperados := n_real * (n_real - 1) / 2;
    if creados != esperados then
      raise exception 'error armando el grupo % (esperaba % partidos, se armaron %) — avisale a Camilo', g.grupo, esperados, creados;
    end if;
    if exists (
      select 1 from (
        select team1_id, team2_id from matches
        where tournament_id = p_tournament_id and bracket = 'grupos' and grupo = g.grupo
        group by team1_id, team2_id
        having count(*) > 1
      ) dup
    ) then
      raise exception 'error armando el grupo % (partido repetido) — avisale a Camilo', g.grupo;
    end if;
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

-- ── Mismo candado para cerrar la fase de grupos (armar las copas) ────

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

  select * into t from tournaments where id = p_tournament_id for update;
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
  select team_id, grupo, pg, pf, (pf - pc) as dif,
    row_number() over (partition by grupo order by pg desc, (pf - pc) desc, pf desc) as posicion,
    null::text as destino
  from resultados;

  for rule in select jsonb_array_elements(coalesce(t.grupos_config -> 'reglas', '[]'::jsonb)) loop
    if (rule ->> 'tipo') = 'split' then
      with candidatos as (
        select team_id, row_number() over (order by pg desc, dif desc, pf desc) as rk
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

  select array_agg(team_id order by pg desc, dif desc, pf desc) into equipos_oro from clasif where destino = 'oro';
  select array_agg(team_id order by pg desc, dif desc, pf desc) into equipos_plata from clasif where destino = 'plata';

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

-- ── Mismo candado para el equipo tardío en la fase de grupos ─────────

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
  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments tt where tt.id = p_tournament_id and tt.organizador_id = auth.uid())
  ) then
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
