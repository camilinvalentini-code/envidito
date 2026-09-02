-- "Resortear fase de grupos" (volver a armar grupos y cruces desde
-- cero) pasa a tener el mismo límite de 3 veces, con el mismo contador
-- (tournaments.resorteos, clave "grupos:armado"). El primer armado
-- (cuando el torneo todavía no tenía grupos armados) NO cuenta contra
-- el límite — solo cuenta cuando se resortea sobre una fase de grupos
-- que ya existía.

create or replace function public.generar_fase_grupos_desde_fixture(
  p_tournament_id uuid, p_cantidad_grupos int, p_asignacion jsonb, p_fixture jsonb
) returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  jugados int;
  item jsonb;
  t tournaments%rowtype;
  clave constant text := 'grupos:armado';
  usados int;
  limite constant int := 3;
  es_resorteo boolean;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into t from tournaments where id = p_tournament_id for update;
  if not found then raise exception 'Torneo no encontrado'; end if;

  es_resorteo := t.grupos_generados;
  if es_resorteo then
    usados := coalesce((t.resorteos ->> clave)::int, 0);
    if usados >= limite then
      raise exception 'La fase de grupos ya se resorteó % veces — es el máximo. Si hace falta cambiar algo puntual, usá "Borrar fecha" en vez de resortear todo.', limite;
    end if;
  end if;

  if p_cantidad_grupos < 1 then
    raise exception 'La cantidad de grupos tiene que ser al menos 1';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_asignacion) x
    where not exists (select 1 from teams tm where tm.id = (x->>'team_id')::uuid and tm.tournament_id = p_tournament_id)
  ) then
    raise exception 'Algún equipo no pertenece a este torneo';
  end if;

  select count(*) into jugados from matches
    where tournament_id = p_tournament_id and bracket = 'grupos' and winner_id is not null;
  if jugados > 0 then
    raise exception 'Ya hay partidos de grupos jugados — no se puede volver a sortear';
  end if;

  delete from matches where tournament_id = p_tournament_id and bracket = 'grupos';
  update teams set grupo = null where tournament_id = p_tournament_id;

  for item in select * from jsonb_array_elements(p_asignacion) loop
    update teams set grupo = (item->>'grupo')::int
      where id = (item->>'team_id')::uuid and tournament_id = p_tournament_id;
  end loop;

  insert into matches (tournament_id, bracket, grupo, round_index, match_index, team1_id, team2_id, bye, match_token)
  select
    p_tournament_id,
    'grupos',
    (t.f->>'grupo')::int,
    (t.f->>'fecha')::int,
    (row_number() over (partition by (t.f->>'grupo')::int, (t.f->>'fecha')::int order by t.ord) - 1)::int,
    (t.f->>'team1_id')::uuid,
    (t.f->>'team2_id')::uuid,
    false,
    encode(gen_random_bytes(8), 'hex')
  from jsonb_array_elements(p_fixture) with ordinality as t(f, ord);

  update tournaments set
    formato = 'grupos',
    grupos_config = jsonb_set(coalesce(grupos_config, '{}'::jsonb), '{cantidad_grupos}', to_jsonb(p_cantidad_grupos)),
    grupos_generados = true,
    resorteos = case when es_resorteo
      then jsonb_set(coalesce(resorteos, '{}'::jsonb), array[clave], to_jsonb(usados + 1))
      else coalesce(resorteos, '{}'::jsonb)
    end
  where id = p_tournament_id;
end;
$$;
grant execute on function public.generar_fase_grupos_desde_fixture(uuid, int, jsonb, jsonb) to authenticated;
revoke execute on function public.generar_fase_grupos_desde_fixture(uuid, int, jsonb, jsonb) from anon;
revoke execute on function public.generar_fase_grupos_desde_fixture(uuid, int, jsonb, jsonb) from public;
