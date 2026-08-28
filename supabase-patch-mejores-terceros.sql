-- "Mejores terceros" en la fase de grupos.
--
-- Hasta ahora, cerrar la fase de grupos solo sabía "clasifican los
-- primeros N de cada grupo, sin mezclar entre grupos". Con 24 parejas
-- en 6 grupos de 4, eso obliga a que sea todo par (12, 18, 24) — no
-- deja armar un cuadro de 16 (2 directos x 6 grupos = 12, + los 4
-- mejores terceros de todo el torneo por diferencia de tantos, como en
-- un mundial).
--
-- generar_copas() YA sabía hacer exactamente esto (la regla de tipo
-- 'split': toma todos los equipos de una misma posición en TODOS los
-- grupos, los ordena entre sí, y separa los mejores de los demás) —
-- solo faltaba que cerrar_fase_grupos_simple supiera armar esa regla.
-- Este patch cambia cerrar_fase_grupos_simple para que la arme, y de
-- paso agrega "puntos a favor" como tercer desempate (después de
-- partidos ganados y diferencia de tantos), tanto para ordenar cada
-- grupo como para ordenar a los terceros entre sí.
--
-- Se deja de lado, por ahora, la Copa de Plata en este flujo simple
-- (se puede retomar más adelante si hace falta) — todo lo que clasifica
-- (directos + mejores terceros) arma un solo cuadro.
--
-- Requiere haber corrido antes supabase-patch-modo-grupos.sql y
-- supabase-patch-copas-oro-plata.sql.

drop function if exists public.cerrar_fase_grupos_simple(uuid, int, int);

-- ── generar_copas: sumamos "puntos a favor" como tercer desempate ────

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

-- ── cerrar_fase_grupos_simple: ahora arma la regla de "mejores terceros" ──
-- p_directos_por_grupo: cuántos clasifican siempre, de cada grupo (1°, 2°, ...).
-- p_mejores_siguientes: opcional. Si es > 0, además de los directos, se
--   suman los mejores "p_mejores_siguientes" equipos que hayan quedado
--   en el puesto siguiente (p_directos_por_grupo + 1) de CUALQUIER
--   grupo, ordenados entre sí por partidos ganados, diferencia de
--   tantos y puntos a favor. Los que no entran, quedan afuera (no arman
--   Copa de Plata en este flujo).

create or replace function public.cerrar_fase_grupos_simple(
  p_tournament_id uuid, p_directos_por_grupo int, p_mejores_siguientes int default 0
) returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  reglas jsonb;
  i int;
begin
  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments t where t.id = p_tournament_id and t.organizador_id = auth.uid())
  ) then
    raise exception 'no autorizado';
  end if;

  if p_directos_por_grupo < 1 then
    raise exception 'tienen que clasificar al menos 1 equipo directo por grupo';
  end if;
  if p_mejores_siguientes < 0 then
    raise exception 'la cantidad de mejores siguientes no puede ser negativa';
  end if;

  reglas := '[]'::jsonb;
  for i in 1..p_directos_por_grupo loop
    reglas := reglas || jsonb_build_array(jsonb_build_object('posicion', i, 'destino', 'oro'));
  end loop;

  if p_mejores_siguientes > 0 then
    reglas := reglas || jsonb_build_array(jsonb_build_object(
      'tipo', 'split',
      'posicion', p_directos_por_grupo + 1,
      'cantidad_top', p_mejores_siguientes,
      'destino_top', 'oro',
      'destino_resto', null
    ));
  end if;

  update tournaments
    set grupos_config = jsonb_set(coalesce(grupos_config, '{}'::jsonb), '{reglas}', reglas)
    where id = p_tournament_id;

  perform public.generar_copas(p_tournament_id, false);
end;
$$;
revoke execute on function public.cerrar_fase_grupos_simple(uuid, int, int) from anon, public;
grant execute on function public.cerrar_fase_grupos_simple(uuid, int, int) to authenticated;
