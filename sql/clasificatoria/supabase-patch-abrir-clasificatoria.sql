-- generar_clasificatoria y resortear_clasificatoria tenían el mismo
-- candado de role='admin' que ya se le sacó a anotarse_equipo (ver
-- supabase-patch-abrir-autoinscripcion.sql) — se me pasaron en esa
-- pasada porque son funciones hermanas, no la misma. Mismo criterio:
-- ya se probó bastante, se abre a cualquier organizador dueño de su
-- propio torneo (el chequeo de auth.uid() = organizador_id / is_admin()
-- que ya tenían las dos se mantiene igual).

create or replace function public.generar_clasificatoria(p_tournament_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  t tournaments%rowtype;
  equipos uuid[];
  n int;
  i int;
  t1 uuid; t2 uuid;
begin
  select * into t from tournaments where id = p_tournament_id;
  if not found then raise exception 'torneo no encontrado'; end if;
  if t.started then raise exception 'el torneo ya arrancó'; end if;
  if t.modo is distinct from 'vidon' then raise exception 'la clasificatoria previa solo aplica al modo Vidón'; end if;
  if t.clasificatoria_generada then raise exception 'la clasificatoria ya se armó para este torneo'; end if;

  if auth.uid() is not null and not (
    public.is_admin() or t.organizador_id = auth.uid()
  ) then
    raise exception 'no autorizado';
  end if;

  select array_agg(id order by random()) into equipos from teams where tournament_id = p_tournament_id and pendiente_aprobacion = false;
  n := coalesce(array_length(equipos, 1), 0);
  if n < 3 then raise exception 'hacen falta al menos 3 equipos anotados'; end if;
  if (n & (n - 1)) = 0 then raise exception 'con % equipos ya da un cuadro redondo — no hace falta clasificatoria', n; end if;

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

  update tournaments set formato = 'clasificatoria', clasificatoria_generada = true where id = p_tournament_id;
end;
$$;
grant execute on function public.generar_clasificatoria(uuid) to authenticated;
revoke execute on function public.generar_clasificatoria(uuid) from anon;
revoke execute on function public.generar_clasificatoria(uuid) from public;

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
end;
$$;
grant execute on function public.resortear_clasificatoria(uuid) to authenticated;
revoke execute on function public.resortear_clasificatoria(uuid) from anon;
revoke execute on function public.resortear_clasificatoria(uuid) from public;
