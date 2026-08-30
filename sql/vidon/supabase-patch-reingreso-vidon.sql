-- Modo Vidon Bar: deja que el organizador elija a mano qué equipo
-- eliminado ocupa un casillero libre de la primera ronda (en vez de que
-- se llene solo con el primero que pierda). "Sacar" un equipo de un
-- casillero NO lo borra del torneo — solo vacía ese casillero puntual,
-- el equipo sigue existiendo y puede reasignarse a otro lado.

create or replace function public.asignar_equipo_casillero_vidon(p_match_id uuid, p_team_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  t_modo text;
begin
  select * into m from matches where id = p_match_id;
  if not found then
    raise exception 'partido inexistente';
  end if;
  if m.winner_id is not null then
    raise exception 'ese partido ya se jugó, no se puede editar';
  end if;
  if m.bracket <> 'main' or m.round_index <> 0 then
    raise exception 'el reingreso solo se puede hacer en la primera ronda';
  end if;

  select modo into t_modo from tournaments where id = m.tournament_id;
  if t_modo is distinct from 'vidon' then
    raise exception 'este torneo no está en modo Vidon';
  end if;

  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments t where t.id = m.tournament_id and t.organizador_id = auth.uid())
  ) then
    raise exception 'no autorizado';
  end if;

  if not exists (select 1 from teams where id = p_team_id and tournament_id = m.tournament_id) then
    raise exception 'ese equipo no pertenece a este torneo';
  end if;

  if m.team1_id = p_team_id or m.team2_id = p_team_id then
    return; -- ya está en este casillero, no hay nada que hacer
  end if;

  if exists (
    select 1 from matches
    where tournament_id = m.tournament_id and winner_id is null
      and (team1_id = p_team_id or team2_id = p_team_id)
  ) then
    raise exception 'ese equipo ya está anotado en otro partido pendiente';
  end if;

  if m.team1_id is null then
    update matches set team1_id = p_team_id where id = p_match_id;
  elsif m.team2_id is null then
    update matches set team2_id = p_team_id where id = p_match_id;
  else
    raise exception 'ese casillero ya está completo';
  end if;
end;
$$;

revoke execute on function public.asignar_equipo_casillero_vidon(uuid, uuid) from anon;
revoke execute on function public.asignar_equipo_casillero_vidon(uuid, uuid) from public;
grant execute on function public.asignar_equipo_casillero_vidon(uuid, uuid) to authenticated;
