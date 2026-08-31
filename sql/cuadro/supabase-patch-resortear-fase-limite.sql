-- "Resortear fase" (Octavos/Cuartos/Semis, de cualquier bracket — main,
-- oro o plata) pasa a tener un límite: 3 veces por fase. Sin esto, un
-- organizador nervioso podía resortear la misma fase sin parar. El
-- contador vive en tournaments.resorteos (jsonb, clave "bracket:ronda")
-- y sobrevive aunque la fase se resortee muchas veces, porque no se
-- guarda en la fila de matches (esa se borra y se recrea cada vez).

alter table tournaments add column if not exists resorteos jsonb not null default '{}'::jsonb;

create or replace function public.resortear_fase(p_tournament_id uuid, p_bracket text, p_round_index int)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  ids uuid[];
  shuffled uuid[];
  m record;
  idx int := 1;
  clave text := p_bracket || ':' || p_round_index;
  usados int;
  limite constant int := 3;
begin
  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments t where t.id = p_tournament_id and t.organizador_id = auth.uid())
  ) then
    raise exception 'No autorizado';
  end if;

  select coalesce((resorteos ->> clave)::int, 0) into usados from tournaments where id = p_tournament_id for update;
  if usados >= limite then
    raise exception 'Esta fase ya se resorteó % veces — es el máximo. Si hace falta cambiarla, tocá los cruces a mano.', limite;
  end if;

  if exists (
    select 1 from matches
    where tournament_id = p_tournament_id and bracket = p_bracket and round_index = p_round_index
      and (team1_id is null or team2_id is null)
  ) then
    raise exception 'Todavía no están definidos todos los cruces de esta fase';
  end if;

  if exists (
    select 1 from matches
    where tournament_id = p_tournament_id and bracket = p_bracket and round_index = p_round_index
      and (winner_id is not null or score_a > 0 or score_b > 0)
  ) then
    raise exception 'Ya se jugó algo en esta fase, no se puede resortear';
  end if;

  select array_agg(x order by random()) into shuffled from (
    select team1_id as x from matches where tournament_id = p_tournament_id and bracket = p_bracket and round_index = p_round_index
    union all
    select team2_id from matches where tournament_id = p_tournament_id and bracket = p_bracket and round_index = p_round_index
  ) s;

  for m in
    select id from matches
    where tournament_id = p_tournament_id and bracket = p_bracket and round_index = p_round_index
    order by match_index
  loop
    update matches set team1_id = shuffled[idx], team2_id = shuffled[idx + 1], avisado = false, avisado_espera = false where id = m.id;
    idx := idx + 2;
  end loop;

  update tournaments set resorteos = jsonb_set(resorteos, array[clave], to_jsonb(usados + 1)) where id = p_tournament_id;
end;
$$;
grant execute on function public.resortear_fase(uuid, text, int) to authenticated;
revoke execute on function public.resortear_fase(uuid, text, int) from anon;
revoke execute on function public.resortear_fase(uuid, text, int) from public;
