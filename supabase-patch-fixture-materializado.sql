-- Cuarta vuelta del arreglo del sorteo de grupos — esta vez con una
-- causa concreta identificada, no solo "cambiemos el enfoque".
--
-- Comparando a mano cada partido esperado contra lo que realmente
-- salió, el patrón fue exacto: en TODOS los grupos, un casillero
-- puntual de la fórmula (siempre el mismo lugar) terminaba con un
-- equipo de otro grupo. La lista de equipos de cada grupo se arma con
-- `array_agg(id order by random())` — y como `random()` en Postgres es
-- "volatile", el motor tiene permiso de volver a evaluar esa expresión
-- cada vez que se la referencia. Como la lista se usaba dos veces por
-- partido (una para elegir el equipo "i", otra para el equipo "j"), es
-- posible que cada uso viera un orden al azar DISTINTO — pescando
-- equipos de la posición equivocada, a veces de otro grupo.
--
-- El arreglo: calcular esa lista UNA sola vez, en una tabla temporal
-- (no una subconsulta que se pueda volver a evaluar) — el mismo truco
-- que ya usa, hace tiempo y sin problemas, la función que arma las
-- copas de oro/plata (generar_copas, con su tabla temporal "clasif").
-- Una vez que la lista está en una tabla de verdad, no hay forma de
-- que se recalcule sola — cada partido lee siempre los mismos datos.
--
-- Requiere haber corrido antes supabase-patch-candado-grupos.sql.

create or replace function public.generar_fase_grupos(p_tournament_id uuid, p_cantidad_grupos int)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  jugados int;
  equipos uuid[];
  n int;
  i int;
  total_real int;
  total_esperado int;
begin
  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments t where t.id = p_tournament_id and t.organizador_id = auth.uid())
  ) then
    raise exception 'no autorizado';
  end if;

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

  -- Se materializa UNA VEZ la lista de equipos (en orden al azar) de
  -- cada grupo, junto con los números que ya usa la fórmula de fechas
  -- — todo calculado acá adentro, nunca más recalculado.
  create temporary table grp_datos on commit drop as
  select
    grupo,
    array_agg(id order by random()) as ids,
    count(*) as n_real,
    (count(*) + (count(*) % 2)) as n_grupo,
    (count(*) + (count(*) % 2) - 1) as m,
    ((count(*) + (count(*) % 2) - 1 + 1) / 2) as inv2
  from teams
  where tournament_id = p_tournament_id and grupo is not null
  group by grupo;

  insert into matches (tournament_id, bracket, grupo, round_index, match_index, team1_id, team2_id, bye, match_token)
  select
    p_tournament_id,
    'grupos',
    g.grupo,
    (case
       when pos.i = g.n_grupo then pos.j - 1
       when pos.j = g.n_grupo then pos.i - 1
       else (((pos.i - 1) + (pos.j - 1)) * g.inv2) % g.m
     end),
    (row_number() over (partition by g.grupo order by pos.i, pos.j) - 1),
    g.ids[pos.i],
    g.ids[pos.j],
    false,
    encode(gen_random_bytes(8), 'hex')
  from grp_datos g
  cross join lateral (
    select gs1.i, gs2.j
    from generate_series(1, g.n_real) as gs1(i)
    cross join generate_series(1, g.n_real) as gs2(j)
    where gs2.j > gs1.i
  ) pos;

  if exists (
    select 1 from matches m
    join teams t on t.id in (m.team1_id, m.team2_id)
    where m.tournament_id = p_tournament_id and m.bracket = 'grupos'
      and t.grupo is distinct from m.grupo
  ) then
    raise exception 'error armando la fase de grupos (un equipo quedó en un partido de otro grupo) — avisale a Camilo';
  end if;

  if exists (
    select 1 from matches
    where tournament_id = p_tournament_id and bracket = 'grupos' and team1_id = team2_id
  ) then
    raise exception 'error armando la fase de grupos (un equipo quedó jugando contra sí mismo) — avisale a Camilo';
  end if;

  if exists (
    select 1 from (
      select grupo, team1_id, team2_id from matches
      where tournament_id = p_tournament_id and bracket = 'grupos'
      group by grupo, team1_id, team2_id
      having count(*) > 1
    ) dup
  ) then
    raise exception 'error armando la fase de grupos (un partido quedó repetido) — avisale a Camilo';
  end if;

  if exists (
    select 1 from (
      select grupo, round_index, team1_id as tid from matches
        where tournament_id = p_tournament_id and bracket = 'grupos'
      union all
      select grupo, round_index, team2_id from matches
        where tournament_id = p_tournament_id and bracket = 'grupos'
    ) t
    group by grupo, round_index, tid
    having count(*) > 1
  ) then
    raise exception 'error armando la fase de grupos (un equipo juega dos veces en la misma fecha) — avisale a Camilo';
  end if;

  select count(*) into total_real
    from matches where tournament_id = p_tournament_id and bracket = 'grupos';
  select coalesce(sum(cnt * (cnt - 1) / 2), 0) into total_esperado from (
    select grupo, count(*) as cnt from teams
      where tournament_id = p_tournament_id and grupo is not null
      group by grupo
  ) s;
  if total_real != total_esperado then
    raise exception 'error armando la fase de grupos (esperaba % partidos en total, se armaron %) — avisale a Camilo', total_esperado, total_real;
  end if;

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
