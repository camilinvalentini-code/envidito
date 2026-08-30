-- Quinta vuelta del sorteo de grupos — diseño sin arrays.
--
-- Los cuatro intentos anteriores (rotación tipo Berger, loop simple,
-- SQL declarativo con array_agg + LATERAL, y esa misma idea con tabla
-- temporal) mostraron la misma forma de error: un equipo de OTRO grupo
-- colándose en un partido, siempre en un casillero puntual. No se pudo
-- confirmar la causa exacta ninguna de las veces — así que en vez de
-- seguir ajustando la misma familia de enfoque (todos usaban un array
-- por grupo, indexado con array[i]/array[j]), se cambia a algo que no
-- tiene arrays en absoluto:
--
--   1) Se numera cada equipo dentro de su grupo (posición 1, 2, 3...),
--      al azar, UNA sola vez — con `row_number() over (partition by
--      grupo order by random())`, forzado a calcularse una sola vez
--      con MATERIALIZED (la forma oficial de Postgres 12+ para
--      garantizar que una subconsulta con random() no se vuelva a
--      evaluar cada vez que se la usa).
--   2) Los partidos salen de un SELF-JOIN de esa numeración contra sí
--      misma, emparejando solo filas con el MISMO grupo (p2.grupo =
--      p1.grupo) y p2.posicion > p1.posicion — la forma más básica y
--      probada de SQL para "todos los pares dentro de un mismo grupo",
--      sin indexar ningún array a mano.
--
-- La fecha de cada partido sigue siendo la misma fórmula ya verificada
-- (grupos de 2 a 25 equipos, caso real 25 parejas → 12-12-12-2-2), solo
-- que ahora usa las columnas "posicion" en vez de índices de array.
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

  with pos as materialized (
    select
      t.id as team_id,
      t.grupo,
      row_number() over (partition by t.grupo order by random()) as posicion,
      count(*) over (partition by t.grupo) as n_real
    from teams t
    where t.tournament_id = p_tournament_id and t.grupo is not null
  )
  insert into matches (tournament_id, bracket, grupo, round_index, match_index, team1_id, team2_id, bye, match_token)
  select
    p_tournament_id,
    'grupos',
    p1.grupo,
    (case
       when p1.posicion = (p1.n_real + (p1.n_real % 2)) then p2.posicion - 1
       when p2.posicion = (p1.n_real + (p1.n_real % 2)) then p1.posicion - 1
       else (
         ((p1.posicion - 1) + (p2.posicion - 1))
         * (((p1.n_real + (p1.n_real % 2) - 1) + 1) / 2)
       ) % (p1.n_real + (p1.n_real % 2) - 1)
     end),
    (row_number() over (partition by p1.grupo order by p1.posicion, p2.posicion) - 1),
    p1.team_id,
    p2.team_id,
    false,
    encode(gen_random_bytes(8), 'hex')
  from pos p1
  join pos p2 on p2.grupo = p1.grupo and p2.posicion > p1.posicion;

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
