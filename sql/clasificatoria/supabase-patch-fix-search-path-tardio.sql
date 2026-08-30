-- Arregla agregar_tardio_clasificatoria: le faltaba "extensions" en el
-- search_path, así que no encontraba gen_random_bytes (vive en ese
-- schema en Supabase) al armar el match_token de un cruce nuevo para
-- una pareja tardía. Las otras funciones de la clasificatoria ya lo
-- tenían bien — esta quedó afuera por descuido. Lógica sin cambios.

create or replace function public.agregar_tardio_clasificatoria(p_tournament_id uuid, p_team_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  t tournaments%rowtype;
  destino matches%rowtype;
  siguiente_idx int;
begin
  select * into t from tournaments where id = p_tournament_id;
  if not found then raise exception 'torneo no encontrado'; end if;
  if t.formato is distinct from 'clasificatoria' or not t.clasificatoria_generada then
    raise exception 'este torneo no tiene una clasificatoria armada';
  end if;
  if t.clasificatoria_cerrada then raise exception 'la clasificatoria ya se cerró'; end if;

  if auth.uid() is not null and not (
    public.is_admin() or t.organizador_id = auth.uid()
  ) then
    raise exception 'no autorizado';
  end if;

  if not exists (select 1 from teams where id = p_team_id and tournament_id = p_tournament_id) then
    raise exception 'ese equipo no pertenece a este torneo';
  end if;

  if exists (
    select 1 from matches
    where tournament_id = p_tournament_id and bracket = 'clasificatoria'
      and (team1_id = p_team_id or team2_id = p_team_id)
  ) then
    return; -- ya está anotado en la clasificatoria, no hay nada que hacer
  end if;

  select * into destino from matches
  where tournament_id = p_tournament_id and bracket = 'clasificatoria'
    and winner_id is null and team1_id is not null and team2_id is null
  order by match_index
  limit 1
  for update;

  if found then
    update matches set team2_id = p_team_id where id = destino.id;
    return;
  end if;

  select coalesce(max(match_index), -1) + 1 into siguiente_idx
    from matches where tournament_id = p_tournament_id and bracket = 'clasificatoria';

  insert into matches (tournament_id, bracket, round_index, match_index, team1_id, team2_id, winner_id, bye, match_token)
  values (p_tournament_id, 'clasificatoria', 0, siguiente_idx, p_team_id, null, null, false, encode(gen_random_bytes(8), 'hex'));
end;
$$;
grant execute on function public.agregar_tardio_clasificatoria(uuid, uuid) to authenticated;
revoke execute on function public.agregar_tardio_clasificatoria(uuid, uuid) from anon;
revoke execute on function public.agregar_tardio_clasificatoria(uuid, uuid) from public;
