-- Reescritura de fondo del armado de partidos de grupos.
--
-- Ya van tres intentos parcheando una función que arma los partidos con
-- un loop de PL/pgSQL (variables que se van reasignando ronda por
-- ronda, grupo por grupo) y en los tres casos terminó filtrándose algo
-- entre grupos que no se pudo aislar del todo mirando el código a
-- mano — el último caso encontrado es larguísimo de explicar pero la
-- forma es siempre la misma: partidos de un grupo apareciendo
-- etiquetados con el número de OTRO grupo.
--
-- En vez de seguir cazando el bug puntual en ese enfoque, se cambia la
-- estrategia de raíz: todo el armado de partidos pasa a ser UN SOLO
-- INSERT declarativo de SQL puro (un INSERT...SELECT con una subconsulta
-- y un LATERAL JOIN), sin ningún loop de PL/pgSQL de por medio para
-- construir los partidos. No hay variables que se vayan reasignando
-- vuelta a vuelta — cada fila (cada partido) se calcula de forma
-- completamente independiente a partir de la tabla temporal de grupos,
-- así que no hay ningún mecanismo por el que el estado de un grupo
-- pueda "contaminar" a otro: estructuralmente no existe el tipo de
-- variable que se filtraba antes.
--
-- La fórmula de la fecha (round_index) es la misma que ya se había
-- verificado con el script aparte (grupos de 2 a 25 equipos, caso real
-- de 25 parejas dando 12-12-12-2-2) — no cambia, solo cambia CÓMO se
-- ejecuta: antes con un loop, ahora con aritmética de columnas en la
-- misma consulta.
--
-- Las verificaciones de seguridad también se simplifican: en vez de
-- repetirlas dentro de un loop por cada grupo, corren UNA sola vez
-- sobre TODO lo insertado, así tampoco dependen de ninguna variable de
-- loop que pudiera estar desactualizada.
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

  -- Todo el fixture, en un solo INSERT declarativo — sin loop, sin
  -- variables mutables. "grp" arma, por grupo, la lista de equipos (en
  -- orden al azar) más los números derivados de la fórmula (n_grupo,
  -- m, inv2). "pos" (con LATERAL) genera, para cada grupo, todos los
  -- pares de posiciones i<j — pura combinatoria, cada par exactamente
  -- una vez. La fecha de cada partido sale de la misma fórmula cerrada
  -- de antes, calculada acá como una expresión más de la consulta.
  insert into matches (tournament_id, bracket, grupo, round_index, match_index, team1_id, team2_id, bye, match_token)
  select
    p_tournament_id,
    'grupos',
    grp.grupo,
    (case
       when pos.i = grp.n_grupo then pos.j - 1
       when pos.j = grp.n_grupo then pos.i - 1
       else (((pos.i - 1) + (pos.j - 1)) * grp.inv2) % grp.m
     end),
    (row_number() over (partition by grp.grupo order by pos.i, pos.j) - 1),
    grp.ids[pos.i],
    grp.ids[pos.j],
    false,
    encode(gen_random_bytes(8), 'hex')
  from (
    select
      grupo,
      array_agg(id order by random()) as ids,
      count(*) as n_real,
      (count(*) + (count(*) % 2)) as n_grupo,
      (count(*) + (count(*) % 2) - 1) as m,
      ((count(*) + (count(*) % 2) - 1 + 1) / 2) as inv2
    from teams
    where tournament_id = p_tournament_id and grupo is not null
    group by grupo
  ) grp
  cross join lateral (
    select gs1.i, gs2.j
    from generate_series(1, grp.n_real) as gs1(i)
    cross join generate_series(1, grp.n_real) as gs2(j)
    where gs2.j > gs1.i
  ) pos;

  -- Verificaciones, una sola vez sobre TODO lo insertado (no adentro de
  -- ningún loop por grupo) — si algo no cierra, se aborta todo el
  -- sorteo antes de dejar nada guardado.

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
