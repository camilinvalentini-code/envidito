-- Equipo tardío en la fase de grupos.
--
-- Mismo caso que ya existía para la clasificatoria (ver
-- agregar_tardio_clasificatoria): un equipo se anota o se aprueba
-- DESPUÉS de que la fase de grupos ya está armada. En vez de tener que
-- resortear todo (perdiendo lo ya jugado), esto lo mete en el grupo
-- que tenga MENOS equipos en ese momento (si hay empate, el de número
-- más bajo) y le arma un partido nuevo contra cada uno de los que ya
-- están en ese grupo — nada de lo ya armado o jugado en los demás
-- grupos se toca.
--
-- Requiere haber corrido antes supabase-patch-modo-grupos.sql.

create or replace function public.agregar_tardio_grupo(p_tournament_id uuid, p_team_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  t tournaments%rowtype;
  grupo_destino int;
  companero record;
  siguiente_round int;
  idx int := 0;
begin
  select * into t from tournaments where id = p_tournament_id;
  if not found then raise exception 'torneo no encontrado'; end if;
  if t.formato is distinct from 'grupos' or not t.grupos_generados then
    raise exception 'este torneo no tiene una fase de grupos armada';
  end if;
  if t.copas_generadas then raise exception 'la fase de grupos ya se cerró'; end if;

  if auth.uid() is not null and not (
    public.is_admin() or t.organizador_id = auth.uid()
  ) then
    raise exception 'no autorizado';
  end if;

  if not exists (select 1 from teams where id = p_team_id and tournament_id = p_tournament_id) then
    raise exception 'ese equipo no pertenece a este torneo';
  end if;

  if exists (select 1 from teams where id = p_team_id and grupo is not null) then
    return; -- ya está en un grupo, no hay nada que hacer
  end if;

  select grupo into grupo_destino
    from teams where tournament_id = p_tournament_id and grupo is not null
    group by grupo
    order by count(*) asc, grupo asc
    limit 1;

  if grupo_destino is null then
    raise exception 'no se encontró a qué grupo sumarlo';
  end if;

  update teams set grupo = grupo_destino where id = p_team_id;

  select coalesce(max(round_index), -1) + 1 into siguiente_round
    from matches where tournament_id = p_tournament_id and bracket = 'grupos' and grupo = grupo_destino;

  for companero in
    select id from teams
    where tournament_id = p_tournament_id and grupo = grupo_destino and id <> p_team_id
  loop
    insert into matches (tournament_id, bracket, grupo, round_index, match_index, team1_id, team2_id, bye, match_token)
    values (p_tournament_id, 'grupos', grupo_destino, siguiente_round, idx, p_team_id, companero.id, false, encode(gen_random_bytes(8), 'hex'));
    idx := idx + 1;
  end loop;
end;
$$;
grant execute on function public.agregar_tardio_grupo(uuid, uuid) to authenticated;
revoke execute on function public.agregar_tardio_grupo(uuid, uuid) from anon;
revoke execute on function public.agregar_tardio_grupo(uuid, uuid) from public;
