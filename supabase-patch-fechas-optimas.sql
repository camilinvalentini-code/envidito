-- Fechas óptimas en la fase de grupos.
--
-- El sorteo de partidos (quién juega contra quién) NO se toca — sigue
-- siendo el mismo método simple y ya probado (todos los pares i<j de
-- cada grupo, sin rotar ningún array). Lo único que cambia es CÓMO se
-- numera la "fecha" (round_index) de cada partido: antes se armaba con
-- un criterio codicioso ("la primera fecha libre para estos dos
-- equipos"), que es siempre correcto pero no necesariamente el mínimo
-- de fechas posible — en un grupo de 5 daba 7 fechas en vez de las 5
-- matemáticamente necesarias.
--
-- Ahora se usa una fórmula cerrada (sin ningún loop con estado que
-- vaya rotando ni reconstruyendo nada) para calcular directamente en
-- qué fecha va cada partido — es el mismo resultado que da el método
-- clásico de "todos contra todos" con el mínimo de fechas, pero
-- calculado de una sola vez por partido en vez de ir armando y
-- rotando un array ronda por ronda (que es justamente el tipo de
-- código que dio el problema anterior).
--
-- Se agrega una verificación nueva y directa: que ningún equipo
-- termine jugando dos veces en la misma fecha — si la fórmula fallara
-- por algún motivo, esto aborta todo el sorteo en vez de dejarlo
-- pasar.
--
-- Requiere haber corrido antes supabase-patch-candado-grupos.sql y
-- supabase-patch-fixture-grupos-simple.sql.

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
  grupo_equipos uuid[];
  n_real int;
  n_grupo int;
  m int;
  inv2 int;
  a int;
  b int;
  t1 uuid;
  t2 uuid;
  ronda int;
  esperados int;
  creados int;
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

  for g in
    select grupo, array_agg(id order by random()) as ids
    from teams where tournament_id = p_tournament_id and grupo is not null
    group by grupo
  loop
    grupo_equipos := g.ids;
    n_real := array_length(grupo_equipos, 1);
    -- n_grupo: tamaño "par" que usa la fórmula. Si n_real ya es par, es
    -- el mismo. Si es impar, se completa con una posición virtual (el
    -- "libre" de esa fecha) que nunca se usa como equipo real.
    n_grupo := n_real + (n_real % 2);
    m := n_grupo - 1; -- siempre impar, para que la fórmula tenga inverso de 2
    inv2 := (m + 1) / 2;
    creados := 0;

    for i in 1..n_real loop
      for j in (i + 1)..n_real loop
        t1 := grupo_equipos[i];
        t2 := grupo_equipos[j];
        if t1 = t2 then
          raise exception 'error armando el grupo % (equipo repetido contra sí mismo) — avisale a Camilo', g.grupo;
        end if;

        -- Fórmula cerrada del método clásico de todos-contra-todos: la
        -- posición n_grupo (si es un equipo real, o sea con n_real
        -- par) queda "fija" y la fecha la da directamente la otra
        -- posición. El resto se calcula con aritmética modular, sin
        -- ningún array que rotar.
        if i = n_grupo or j = n_grupo then
          if i = n_grupo then ronda := j - 1; else ronda := i - 1; end if;
        else
          a := i - 1;
          b := j - 1;
          ronda := ((a + b) * inv2) % m;
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

    if exists (
      select 1 from matches m
      join teams t on t.id in (m.team1_id, m.team2_id)
      where m.tournament_id = p_tournament_id and m.bracket = 'grupos' and m.grupo = g.grupo
        and t.grupo is distinct from g.grupo
    ) then
      raise exception 'error armando el grupo % (un equipo no pertenece a este grupo) — avisale a Camilo', g.grupo;
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

    -- Verificación nueva: que ningún equipo juegue dos veces en la
    -- misma fecha — justo lo que esta fórmula tiene que garantizar.
    if exists (
      select 1 from (
        select round_index, team1_id as tid from matches
          where tournament_id = p_tournament_id and bracket = 'grupos' and grupo = g.grupo
        union all
        select round_index, team2_id from matches
          where tournament_id = p_tournament_id and bracket = 'grupos' and grupo = g.grupo
      ) t
      group by round_index, tid
      having count(*) > 1
    ) then
      raise exception 'error armando el grupo % (un equipo juega dos veces en la misma fecha) — avisale a Camilo', g.grupo;
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
