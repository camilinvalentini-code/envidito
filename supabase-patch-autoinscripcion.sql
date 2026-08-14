-- Autoinscripción de equipos (sin login) + ficha de jugador con datos para
-- premios (DNI, teléfono, fecha de nacimiento, mail).
--
-- Alcance de este lanzamiento: SOLO torneos organizados por un admin de la
-- plataforma (profiles.role = 'admin'). Para cualquier otro organizador el
-- RPC rechaza la inscripción — así se prueba primero antes de ofrecérselo
-- a los organizadores en general.
--
-- Importante: la tabla players hoy tiene "select using (true)" — 100%
-- pública. Agregarle DNI/teléfono/mail sin cerrar eso dejaría esos datos
-- leíbles por cualquiera. Este parche cierra esa lectura en el mismo
-- paso, no como algo aparte.
--
-- Aislamiento por organizador: la búsqueda de "¿este jugador ya existe?"
-- queda acotada a los propios torneos del organizador — nunca cruza a
-- otro organizador, aunque compartan marca/franquicia (sucursales de un
-- mismo nombre pueden tener dueños distintos).

-- 1) Datos nuevos por jugador ---------------------------------------------
alter table players add column if not exists dni text;
alter table players add column if not exists telefono text;
alter table players add column if not exists fecha_nacimiento date;
alter table players add column if not exists email text;

-- 2) Equipos autoinscriptos quedan "pendientes" hasta que el organizador
--    los aprueba. Los equipos que ya carga el organizador (a mano, desde
--    el panel) siguen entrando con el default false — cuentan de una,
--    como siempre.
alter table teams add column if not exists pendiente_aprobacion boolean not null default false;

-- 3) Cerrar la lectura pública de players — ahora tiene DNI/teléfono/mail,
--    solo la tiene que poder ver el organizador dueño de un torneo donde
--    ese jugador esté anotado (o el admin).
drop policy if exists "lectura publica players" on players;
drop policy if exists "organizador ve sus jugadores" on players;
create policy "organizador ve sus jugadores" on players for select
  using (
    public.is_admin() or exists (
      select 1 from team_players tp
      join teams tm on tm.id = tp.team_id
      join tournaments t on t.id = tm.tournament_id
      where tp.player_id = players.id and t.organizador_id = auth.uid()
    )
  );

-- 3b) El organizador tiene que poder corregir DNI/teléfono/fecha/mail de
--     un jugador autoinscripto (hoy solo había lectura). Mismo criterio
--     que la de arriba: dueño de un torneo donde ese jugador está
--     anotado, o admin.
drop policy if exists "organizador edita sus jugadores" on players;
create policy "organizador edita sus jugadores" on players for update
  using (
    public.is_admin() or exists (
      select 1 from team_players tp
      join teams tm on tm.id = tp.team_id
      join tournaments t on t.id = tm.tournament_id
      where tp.player_id = players.id and t.organizador_id = auth.uid()
    )
  );

-- 4) El autocompletado de jugadores (usado por el organizador logueado,
--    con acceso a anon también) solo debe devolver nombre — nunca DNI,
--    teléfono, fecha de nacimiento ni mail de otra gente — y solo entre
--    los propios torneos de quien pregunta.
create or replace function public.buscar_jugadores(q text)
returns table (id uuid, name text, name_norm text) language sql stable security definer
set search_path = public, pg_temp as $$
  select distinct p.id, p.name, p.name_norm
  from players p
  join team_players tp on tp.player_id = p.id
  join teams tm on tm.id = tp.team_id
  join tournaments t on t.id = tm.tournament_id
  where auth.uid() is not null
    and t.organizador_id = auth.uid()
    and p.name_norm ilike '%' || lower(unaccent(q)) || '%'
  order by p.name_norm
  limit 8;
$$;
grant execute on function public.buscar_jugadores(text) to anon, authenticated;

-- 5) Alta pública de un equipo, sin login. Queda "pendiente" hasta que el
--    organizador lo aprueba desde el panel. Solo funciona mientras el
--    torneo todavía no arrancó (sorteo no hecho), y solo para torneos de
--    un organizador admin (ver nota arriba).
--
--    p_honeypot: campo trampa, invisible en el formulario real. Si llega
--    con contenido, es un bot — se corta en silencio (no se inserta
--    nada, pero tampoco se avisa que existe la trampa).
create or replace function public.anotarse_equipo(
  p_tournament_id uuid, p_nombre_equipo text, p_jugadores jsonb, p_honeypot text default ''
) returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_tournament tournaments%rowtype;
  v_organizador_role text;
  v_team_id uuid;
  v_nombre text;
  item jsonb;
  v_item_name text;
  v_dni text;
  v_telefono text;
  v_email text;
  v_player_id uuid;
  v_name_norm text;
  v_alguno boolean := false;
  v_dnis text[] := '{}';
  v_emails text[] := '{}';
  v_telefonos text[] := '{}';
begin
  if coalesce(trim(p_honeypot), '') <> '' then
    return null;
  end if;

  select * into v_tournament from tournaments where id = p_tournament_id;
  if not found then
    raise exception 'ese torneo no existe';
  end if;
  if v_tournament.started then
    raise exception 'las inscripciones ya cerraron';
  end if;

  select role into v_organizador_role from profiles where id = v_tournament.organizador_id;
  if v_organizador_role is distinct from 'admin' then
    raise exception 'las inscripciones no están disponibles para este torneo';
  end if;

  v_nombre := trim(p_nombre_equipo);
  if v_nombre = '' or v_nombre is null then
    raise exception 'falta el nombre del equipo';
  end if;
  -- El nombre de equipo puede llevar números (ej. "Equipo 22") — solo se
  -- exige sin números cuando es 1v1, porque ahí ese campo es el nombre
  -- de la persona.
  if v_tournament.categoria = '1v1' and v_nombre ~ '[0-9]' then
    raise exception 'el nombre no puede tener números';
  end if;

  if p_jugadores is null or jsonb_array_length(p_jugadores) = 0 then
    raise exception 'falta cargar al menos un jugador';
  end if;

  for item in select * from jsonb_array_elements(p_jugadores) loop
    v_item_name := trim(item->>'name');
    if coalesce(v_item_name, '') <> '' then
      v_alguno := true;
      if v_item_name ~ '[0-9]' then
        raise exception 'el nombre de un jugador no puede tener números';
      end if;

      if coalesce(item->>'fecha_nacimiento', '') = '' then
        raise exception 'falta la fecha de nacimiento de un jugador';
      end if;

      v_dni := nullif(trim(item->>'dni'), '');
      if v_dni is not null then
        if v_dni !~ '^[0-9]+$' then
          raise exception 'el DNI solo puede tener números';
        end if;
        if v_dni = any(v_dnis) then
          raise exception 'dos jugadores del equipo no pueden tener el mismo DNI';
        end if;
        v_dnis := array_append(v_dnis, v_dni);
      end if;

      v_telefono := nullif(trim(item->>'telefono'), '');
      if v_telefono is not null then
        if v_telefono !~ '^[0-9 +-]+$' then
          raise exception 'el teléfono solo puede tener números';
        end if;
        if v_telefono = any(v_telefonos) then
          raise exception 'dos jugadores del equipo no pueden tener el mismo teléfono';
        end if;
        v_telefonos := array_append(v_telefonos, v_telefono);
      end if;

      v_email := lower(nullif(trim(item->>'email'), ''));
      if v_email is not null then
        if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
          raise exception 'el mail no es válido';
        end if;
        if v_email = any(v_emails) then
          raise exception 'dos jugadores del equipo no pueden tener el mismo mail';
        end if;
        v_emails := array_append(v_emails, v_email);
      end if;
    end if;
  end loop;
  if not v_alguno then
    raise exception 'falta cargar al menos un jugador';
  end if;

  insert into teams (tournament_id, name, players, paid, pendiente_aprobacion)
  values (p_tournament_id, left(v_nombre, 80), '', false, true)
  returning id into v_team_id;

  for item in select * from jsonb_array_elements(p_jugadores) loop
    if coalesce(trim(item->>'name'), '') = '' then
      continue;
    end if;
    v_name_norm := lower(unaccent(trim(item->>'name')));

    -- Solo reconoce a un jugador ya cargado si está en un equipo de OTRO
    -- torneo del MISMO organizador — nunca cruza a otro organizador,
    -- aunque el nombre coincida.
    select p.id into v_player_id
      from players p
      join team_players tp on tp.player_id = p.id
      join teams tm on tm.id = tp.team_id
      join tournaments t on t.id = tm.tournament_id
      where p.name_norm = v_name_norm and t.organizador_id = v_tournament.organizador_id
      limit 1;

    -- Ni el DNI, ni el mail ni el teléfono pueden ya pertenecer a OTRO
    -- jugador de este mismo organizador (si es el mismo jugador que
    -- reconocimos por nombre arriba, se excluye — puede "repetir" sus
    -- propios datos).
    v_dni := nullif(trim(item->>'dni'), '');
    if v_dni is not null and exists (
      select 1 from players p2
      join team_players tp2 on tp2.player_id = p2.id
      join teams tm2 on tm2.id = tp2.team_id
      join tournaments t2 on t2.id = tm2.tournament_id
      where p2.dni = v_dni
        and t2.organizador_id = v_tournament.organizador_id
        and (v_player_id is null or p2.id <> v_player_id)
    ) then
      raise exception 'ese DNI ya está anotado con otro jugador';
    end if;

    v_telefono := nullif(trim(item->>'telefono'), '');
    if v_telefono is not null and exists (
      select 1 from players p2
      join team_players tp2 on tp2.player_id = p2.id
      join teams tm2 on tm2.id = tp2.team_id
      join tournaments t2 on t2.id = tm2.tournament_id
      where p2.telefono = v_telefono
        and t2.organizador_id = v_tournament.organizador_id
        and (v_player_id is null or p2.id <> v_player_id)
    ) then
      raise exception 'ese teléfono ya está anotado con otro jugador';
    end if;

    v_email := lower(nullif(trim(item->>'email'), ''));
    if v_email is not null and exists (
      select 1 from players p2
      join team_players tp2 on tp2.player_id = p2.id
      join teams tm2 on tm2.id = tp2.team_id
      join tournaments t2 on t2.id = tm2.tournament_id
      where lower(p2.email) = v_email
        and t2.organizador_id = v_tournament.organizador_id
        and (v_player_id is null or p2.id <> v_player_id)
    ) then
      raise exception 'ese mail ya está anotado con otro jugador';
    end if;

    if v_player_id is null then
      insert into players (name, name_norm, dni, telefono, fecha_nacimiento, email)
      values (
        left(trim(item->>'name'), 120),
        v_name_norm,
        nullif(trim(item->>'dni'), ''),
        nullif(trim(item->>'telefono'), ''),
        nullif(item->>'fecha_nacimiento', '')::date,
        nullif(trim(item->>'email'), '')
      )
      returning id into v_player_id;
    else
      update players set
        dni = coalesce(dni, nullif(trim(item->>'dni'), '')),
        telefono = coalesce(telefono, nullif(trim(item->>'telefono'), '')),
        fecha_nacimiento = coalesce(fecha_nacimiento, nullif(item->>'fecha_nacimiento', '')::date),
        email = coalesce(email, nullif(trim(item->>'email'), ''))
      where id = v_player_id;
    end if;

    insert into team_players (team_id, player_id) values (v_team_id, v_player_id)
    on conflict do nothing;
  end loop;

  return v_team_id;
end;
$$;
grant execute on function public.anotarse_equipo(uuid, text, jsonb, text) to anon, authenticated;
