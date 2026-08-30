-- Clasificatoria previa (modo Vidón) — SOLO admin por ahora.
--
-- Para cuando la cantidad de equipos no es potencia de 2 y el
-- organizador quiere que todos jueguen un primer partido antes de
-- armar el cuadro (en vez del reingreso en vivo de siempre). Se juega
-- una sola ronda entre todos, y de los ganadores + los perdedores que
-- se elijan (sorteo o a mano) sale un cuadro limpio, sin casilleros
-- vacíos.
--
-- Alcance de este lanzamiento: igual que autoinscripción, queda
-- restringido de entrada — la función que arranca la clasificatoria
-- exige profiles.role = 'admin' para el organizador del torneo. Se
-- prueba primero en los propios torneos antes de ofrecérselo a
-- cualquier organizador.

-- ── Schema ────────────────────────────────────────────────────────────

alter table tournaments drop constraint if exists tournaments_formato_check;
alter table tournaments add constraint tournaments_formato_check check (formato in ('directa', 'grupos', 'clasificatoria'));
alter table tournaments add column if not exists clasificatoria_generada boolean not null default false;
alter table tournaments add column if not exists clasificatoria_cerrada boolean not null default false;

alter table matches drop constraint if exists matches_bracket_check;
alter table matches add constraint matches_bracket_check check (bracket in ('main', 'repechaje', 'grupos', 'oro', 'plata', 'clasificatoria'));

-- ── Armar la clasificatoria: todos contra todos, una ronda ────────────
-- Si sobra un equipo (cantidad impar), queda solo como "espera rival"
-- (igual que en el cuadro Vidón de siempre) en vez de pasar gratis —
-- así, si llega una pareja tardía, se le puede completar ese cruce sin
-- tener que resortear nada (ver agregar_tardio_clasificatoria).

create or replace function public.generar_clasificatoria(p_tournament_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  t tournaments%rowtype;
  v_organizador_role text;
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

  select role into v_organizador_role from profiles where id = t.organizador_id;
  if v_organizador_role is distinct from 'admin' then
    raise exception 'la clasificatoria previa no está disponible para este torneo';
  end if;

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

-- ── Pareja tardía: se anota y se agrega a la clasificatoria ───────────
-- Primero hay que cargarla como equipo del torneo (como siempre), y
-- después llamar a esto con su id. Si hay un cruce esperando rival, lo
-- completa. Si no hay ninguno, le arma su propio cruce nuevo, también
-- esperando rival — nada de lo ya jugado o pendiente se toca.

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

-- ── Cerrar la clasificatoria y armar el cuadro limpio ──────────────────
-- p_perdedores_elegidos: los perdedores que el organizador (a mano o
-- por sorteo, eso lo decide el panel) eligió para completar el cupo.
-- Si todavía queda algún cruce "esperando rival" sin completar, ese
-- equipo pasa directo (nadie apareció, no se lo puede tener esperando
-- para siempre) antes de cerrar.

create or replace function public.cerrar_clasificatoria(p_tournament_id uuid, p_perdedores_elegidos uuid[])
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  t tournaments%rowtype;
  pendientes int;
  ganadores uuid[];
  clasificados uuid[];
  n int;
  perdedor_id uuid;
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

  select count(*) into pendientes from matches
    where tournament_id = p_tournament_id and bracket = 'clasificatoria'
      and winner_id is null and team1_id is not null and team2_id is not null;
  if pendientes > 0 then
    raise exception 'todavía faltan % partido(s) de la clasificatoria', pendientes;
  end if;

  -- Los que quedaron solos esperando rival (nadie llegó) pasan directo.
  update matches set winner_id = team1_id, bye = true
    where tournament_id = p_tournament_id and bracket = 'clasificatoria'
      and winner_id is null and team1_id is not null and team2_id is null;

  select array_agg(winner_id) into ganadores
    from matches where tournament_id = p_tournament_id and bracket = 'clasificatoria' and winner_id is not null;

  foreach perdedor_id in array coalesce(p_perdedores_elegidos, '{}') loop
    if not exists (
      select 1 from matches
      where tournament_id = p_tournament_id and bracket = 'clasificatoria' and winner_id is not null
        and ((team1_id = perdedor_id and winner_id <> perdedor_id) or (team2_id = perdedor_id and winner_id <> perdedor_id))
    ) then
      raise exception 'un equipo elegido no perdió ningún partido de la clasificatoria';
    end if;
  end loop;

  clasificados := coalesce(ganadores, '{}') || coalesce(p_perdedores_elegidos, '{}');
  n := coalesce(array_length(clasificados, 1), 0);
  if n < 2 or (n & (n - 1)) <> 0 then
    raise exception 'la cantidad de clasificados (%) no da un cuadro redondo', n;
  end if;

  perform public.generar_bracket(p_tournament_id, 'main', clasificados, true);
  update tournaments set clasificatoria_cerrada = true, started = true where id = p_tournament_id;
end;
$$;
grant execute on function public.cerrar_clasificatoria(uuid, uuid[]) to authenticated;
revoke execute on function public.cerrar_clasificatoria(uuid, uuid[]) from anon;
revoke execute on function public.cerrar_clasificatoria(uuid, uuid[]) from public;
