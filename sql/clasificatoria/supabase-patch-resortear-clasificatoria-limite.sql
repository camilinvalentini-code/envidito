-- "Resortear clasificatoria" pasa a tener el mismo límite que ya tiene
-- "Resortear fase" (Octavos/Cuartos/etc.): 3 veces. Mismo contador
-- (tournaments.resorteos, jsonb por clave "bracket:ronda"), clave
-- "clasificatoria:0" en este caso.

create or replace function public.resortear_clasificatoria(p_tournament_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  t tournaments%rowtype;
  jugado int;
  equipos uuid[];
  n int;
  i int;
  t1 uuid; t2 uuid;
  clave constant text := 'clasificatoria:0';
  usados int;
  limite constant int := 3;
begin
  select * into t from tournaments where id = p_tournament_id for update;
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

  usados := coalesce((t.resorteos ->> clave)::int, 0);
  if usados >= limite then
    raise exception 'La clasificatoria ya se resorteó % veces — es el máximo. Si hace falta cambiarla, tocá los cruces a mano.', limite;
  end if;

  select count(*) into jugado from matches
    where tournament_id = p_tournament_id and bracket = 'clasificatoria' and winner_id is not null;
  if jugado > 0 then
    raise exception 'ya se jugó algo de la clasificatoria — no se puede resortear';
  end if;

  select array_agg(id order by random()) into equipos from teams where tournament_id = p_tournament_id and pendiente_aprobacion = false;
  n := coalesce(array_length(equipos, 1), 0);
  if n < 3 then raise exception 'hacen falta al menos 3 equipos anotados'; end if;

  delete from matches where tournament_id = p_tournament_id and bracket = 'clasificatoria';

  i := 1;
  while i <= n loop
    if i < n then
      t1 := equipos[i]; t2 := equipos[i + 1];
    else
      t1 := equipos[i]; t2 := null; -- impar: queda esperando rival
    end if;
    insert into matches (tournament_id, bracket, round_index, match_index, team1_id, team2_id, winner_id, bye, match_token)
    values (p_tournament_id, 'clasificatoria', 0, (i - 1) / 2, t1, t2, null, false, encode(gen_random_bytes(8), 'hex'));
    i := i + 2;
  end loop;

  update tournaments set resorteos = jsonb_set(coalesce(resorteos, '{}'::jsonb), array[clave], to_jsonb(usados + 1))
    where id = p_tournament_id;
end;
$$;
grant execute on function public.resortear_clasificatoria(uuid) to authenticated;
revoke execute on function public.resortear_clasificatoria(uuid) from anon;
revoke execute on function public.resortear_clasificatoria(uuid) from public;
