-- Séptima (y última, con red de seguridad) vuelta del sorteo de grupos.
--
-- El patrón encontrado en el intento anterior (tabla temporal + SELECT
-- puntual por posición) fue muy revelador: el partido que salía mal
-- SIEMPRE era el 3er o 5to partido creado dentro de cada grupo — no
-- dependía de qué grupo fuera. Eso es la huella de un comportamiento
-- conocido de PostgreSQL: una consulta parametrizada que se ejecuta
-- muchas veces dentro de una misma función pasa, después de la 5ta
-- ejecución, de un "plan a medida" (custom plan, recalculado para
-- cada valor) a uno "genérico" (genérico, reusado) — pensado para
-- ahorrar trabajo en consultas repetitivas. Acá se hacían decenas de
-- SELECT puntuales con la misma forma ("dame el equipo en la posición
-- N del grupo G"), un caso de uso exactamente así.
--
-- Dos arreglos en paralelo, para no depender de acertarle a la causa
-- exacta:
--
--   1) Se fuerza a Postgres a NO cambiar nunca de plan (siempre
--      "a medida") con `plan_cache_mode = force_custom_plan`, fijado
--      para toda la función.
--   2) Por las dudas de que la causa fuera otra cosa: la función ahora
--      se auto-verifica después de armar cada grupo, y si algo no
--      cierra, BORRA esos partidos y los vuelve a armar (con un nuevo
--      sorteo al azar) — hasta 5 veces — en vez de confiar ciegamente
--      en una sola pasada. Si después de 5 intentos sigue sin cerrar,
--      recién ahí aborta todo con un error.
--
-- Requiere haber corrido antes supabase-patch-candado-grupos.sql.

create or replace function public.generar_fase_grupos(p_tournament_id uuid, p_cantidad_grupos int)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp
set plan_cache_mode = force_custom_plan
as $$
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
  intento int;
  grupo_ok boolean;
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

  create temporary table pos_grupos on commit drop as
  select
    t.id as team_id,
    t.grupo,
    row_number() over (partition by t.grupo order by random()) as posicion
  from teams t
  where t.tournament_id = p_tournament_id and t.grupo is not null;

  if exists (
    select 1 from pos_grupos group by grupo, posicion having count(*) > 1
  ) then
    raise exception 'error armando la fase de grupos (posición repetida al numerar los equipos) — avisale a Camilo';
  end if;

  -- Un grupo por vez, y cada grupo se arma y se verifica ANTES de
  -- pasar al siguiente. Si algo no cierra, se borra SOLO lo de ese
  -- grupo y se reintenta (con un nuevo orden al azar) hasta 5 veces.
  for g in select distinct grupo from pos_grupos order by grupo loop
    select count(*) into n_real from pos_grupos where grupo = g.grupo;
    esperados := n_real * (n_real - 1) / 2;
    grupo_ok := false;

    for intento in 1..5 loop
      delete from matches where tournament_id = p_tournament_id and bracket = 'grupos' and grupo = g.grupo;

      if intento > 1 then
        -- Nuevo orden al azar para este grupo puntual, antes de reintentar.
        update pos_grupos p set posicion = nuevo.posicion
          from (
            select team_id, row_number() over (order by random()) as posicion
            from pos_grupos where grupo = g.grupo
          ) nuevo
          where p.team_id = nuevo.team_id and p.grupo = g.grupo;
      end if;

      n_grupo := n_real + (n_real % 2);
      m := n_grupo - 1;
      inv2 := (m + 1) / 2;
      creados := 0;

      for i in 1..n_real loop
        for j in (i + 1)..n_real loop
          select team_id into t1 from pos_grupos where grupo = g.grupo and posicion = i;
          select team_id into t2 from pos_grupos where grupo = g.grupo and posicion = j;

          if t1 is null or t2 is null or t1 = t2 then
            exit; -- algo salió mal en este intento, se corta y se reintenta
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

      -- Verificación de ESTE grupo puntual: la cantidad justa de
      -- partidos, todos entre equipos que de verdad son de este
      -- grupo, sin pares repetidos.
      if creados = esperados
        and not exists (
          select 1 from matches m
          join teams t on t.id in (m.team1_id, m.team2_id)
          where m.tournament_id = p_tournament_id and m.bracket = 'grupos' and m.grupo = g.grupo
            and t.grupo is distinct from g.grupo
        )
        and not exists (
          select 1 from (
            select team1_id, team2_id from matches
            where tournament_id = p_tournament_id and bracket = 'grupos' and grupo = g.grupo
            group by team1_id, team2_id
            having count(*) > 1
          ) dup
        )
      then
        grupo_ok := true;
        exit; -- este grupo quedó bien, no hace falta reintentar más
      end if;
    end loop;

    if not grupo_ok then
      raise exception 'error armando el grupo % después de 5 intentos — avisale a Camilo', g.grupo;
    end if;
  end loop;

  -- Verificación final, sobre TODO el torneo junto (por si dos grupos
  -- ya validados individualmente terminaran compartiendo algo entre
  -- sí, algo que las verificaciones por grupo no podrían ver).
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
