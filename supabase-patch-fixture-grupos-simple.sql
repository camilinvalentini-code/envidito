-- Segunda vuelta del arreglo del sorteo de grupos.
--
-- El método anterior (rotación tipo Berger, con aritmética modular)
-- seguía produciendo un patrón raro y muy puntual: en la ronda 1
-- casillero 0 de TODOS los grupos aparecía siempre el mismo partido de
-- un grupo ajeno, y en la ronda 2 casillero 0 otro. No se pudo aislar
-- con certeza la causa exacta mirando el código a mano — así que en
-- vez de seguir confiando en un método "prolijo" pero difícil de
-- verificar del todo, se reemplaza por el más simple posible:
--
--   para cada par de posiciones i < j dentro del grupo, arma el
--   partido equipo[i] vs equipo[j].
--
-- Esto es pura combinatoria: recorre TODOS los pares posibles una sola
-- vez, sin rotar ni reconstruir ningún array — no hay forma de que
-- repita un equipo contra sí mismo ni que se salte un par. El orden de
-- "ronda" (para que ningún equipo juegue dos veces en la misma ronda,
-- útil si el bar quiere correr varias mesas en simultáneo) se arma con
-- un criterio simple: cada partido nuevo va a la primera ronda donde
-- ninguno de los dos equipos jugó todavía.
--
-- Se agrega además una verificación nueva, más directa que la anterior:
-- después de armar cada grupo, chequea que TODOS los partidos creados
-- sean entre equipos que de verdad pertenecen a ese grupo — si alguno
-- no, aborta todo el sorteo antes de guardar nada, en vez de dejarlo
-- pasar.
--
-- Requiere haber corrido antes supabase-patch-candado-grupos.sql (usa
-- el mismo candado contra doble-toque).

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
  t1 uuid;
  t2 uuid;
  ronda_t1 int;
  ronda_t2 int;
  ronda int;
  ultima_ronda jsonb;
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
    creados := 0;
    ultima_ronda := '{}'::jsonb;

    for i in 1..n_real loop
      for j in (i + 1)..n_real loop
        t1 := grupo_equipos[i];
        t2 := grupo_equipos[j];
        if t1 = t2 then
          raise exception 'error armando el grupo % (equipo repetido contra sí mismo) — avisale a Camilo', g.grupo;
        end if;

        ronda_t1 := coalesce((ultima_ronda ->> t1::text)::int, -1);
        ronda_t2 := coalesce((ultima_ronda ->> t2::text)::int, -1);
        ronda := greatest(ronda_t1, ronda_t2) + 1;
        ultima_ronda := jsonb_set(ultima_ronda, array[t1::text], to_jsonb(ronda));
        ultima_ronda := jsonb_set(ultima_ronda, array[t2::text], to_jsonb(ronda));

        insert into matches (tournament_id, bracket, grupo, round_index, match_index, team1_id, team2_id, bye, match_token)
        values (p_tournament_id, 'grupos', g.grupo, ronda, creados, t1, t2, false, encode(gen_random_bytes(8), 'hex'));
        creados := creados + 1;
      end loop;
    end loop;

    esperados := n_real * (n_real - 1) / 2;
    if creados != esperados then
      raise exception 'error armando el grupo % (esperaba % partidos, se armaron %) — avisale a Camilo', g.grupo, esperados, creados;
    end if;

    -- Verificación directa: todo partido de este grupo tiene que ser
    -- entre dos equipos que de verdad pertenecen a este grupo. Si algo
    -- se coló de otro lado, se aborta todo antes de guardar nada.
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
