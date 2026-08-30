-- Sexta vuelta del sorteo de grupos — la versión más defensiva posible.
--
-- Ya se probaron cinco enfoques distintos (rotación, loop con array,
-- SQL declarativo con array_agg, tabla temporal con array, y self-join
-- sobre un CTE materializado) y los cinco terminaron con el mismo tipo
-- de error: pares repetidos o de otro grupo, siempre en un único INSERT
-- (confirmado con created_at idéntico hasta el microsegundo — no es
-- doble ejecución).
--
-- Esta versión no usa NADA que pueda ser sospechoso: ni arrays, ni
-- CTEs, ni self-joins, ni un INSERT en bloque. Es lo más básico que
-- existe en SQL:
--   1) Una tabla temporal de verdad (no un CTE) con una fila por
--      equipo: grupo, posición (al azar), equipo. Mismo truco que ya
--      usa hace tiempo, sin problemas, generar_copas.
--   2) Un loop de PL/pgSQL que arma los partidos de a uno, y para
--      cada uno hace dos SELECT puntuales ("dame el equipo que está en
--      la posición N del grupo G") — nada de leer un array por índice,
--      nada de unir la tabla contra sí misma.
--   3) Cada partido se inserta con su propio INSERT individual (no un
--      INSERT...SELECT masivo).
--
-- Si esto también falla, el problema no está en cómo se arma la
-- consulta — hay que mirar en otro lado (la conexión, el pooling de
-- Supabase, algo del entorno) y no seguir cambiando la forma del SQL.
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
  j int;
  g record;
  n_real int;
  n_grupo int;
  m int;
  inv2 int;
  t1 uuid;
  t2 uuid;
  ronda int;
  creados int;
  esperados int;
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

  -- Tabla temporal de verdad (no un CTE): una fila por equipo, con su
  -- grupo y su posición al azar dentro de ese grupo. Después de esto,
  -- nada vuelve a tocar random() — es un dato fijo, guardado.
  create temporary table pos_grupos on commit drop as
  select
    t.id as team_id,
    t.grupo,
    row_number() over (partition by t.grupo order by random()) as posicion
  from teams t
  where t.tournament_id = p_tournament_id and t.grupo is not null;

  -- Chequeo de sanidad: cada equipo tiene que tener una posición única
  -- dentro de su grupo (si esto fallara, ni siquiera llegamos a armar
  -- partidos con datos raros).
  if exists (
    select 1 from pos_grupos group by grupo, posicion having count(*) > 1
  ) then
    raise exception 'error armando la fase de grupos (posición repetida al numerar los equipos) — avisale a Camilo';
  end if;

  for g in select distinct grupo from pos_grupos order by grupo loop
    select count(*) into n_real from pos_grupos where grupo = g.grupo;
    n_grupo := n_real + (n_real % 2);
    m := n_grupo - 1;
    inv2 := (m + 1) / 2;
    creados := 0;

    for i in 1..n_real loop
      for j in (i + 1)..n_real loop
        select team_id into t1 from pos_grupos where grupo = g.grupo and posicion = i;
        select team_id into t2 from pos_grupos where grupo = g.grupo and posicion = j;

        if t1 is null or t2 is null or t1 = t2 then
          raise exception 'error armando el grupo % (no se encontró bien un equipo por posición) — avisale a Camilo', g.grupo;
        end if;

        if i = n_grupo then
          ronda := j - 1;
        elsif j = n_grupo then
          ronda := i - 1;
        else
          ronda := ((i - 1) + (j - 1)) * inv2 % m;
        end if;

        insert into matches (tournament_id, bracket, grupo, round_index, match_index, team1_id, team2_id, bye, match_token)
        values (p_tournament_id, 'grupos', g.grupo, ronda, creados, t1, t2, false, encode(gen_random_bytes(8), 'hex'));
        creados := creados + 1;
      end loop;
    end loop;

    esperados := n_real * (n_real - 1) / 2;
    if creados != esperados then
      raise exception 'error armando el grupo % (esperaba % partidos, se armaron %) — avisale a Camilo', g.grupo, esperados, creados;
    end if;
  end loop;

  if exists (
    select 1 from matches m
    join teams t on t.id in (m.team1_id, m.team2_id)
    where m.tournament_id = p_tournament_id and m.bracket = 'grupos'
      and t.grupo is distinct from m.grupo
  ) then
    raise exception 'error armando la fase de grupos (un equipo quedó en un partido de otro grupo) — avisale a Camilo';
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
