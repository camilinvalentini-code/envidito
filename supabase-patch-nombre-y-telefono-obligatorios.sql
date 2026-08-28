-- Dos huecos en la validación real (la del servidor, que es la que
-- importa — el formulario ya se corrigió del lado del cliente):
--
-- 1) Si el nombre de un jugador venía vacío, la función simplemente lo
--    saltaba en silencio (ni error, ni se guardaba) — así se podía
--    anotar un equipo de 2v2 con un solo jugador real cargado. Ahora
--    el nombre es obligatorio para cada jugador, igual que DNI/
--    teléfono/mail/fecha.
-- 2) El teléfono no tenía mínimo de dígitos, solo se validaba el
--    formato. Ahora pide al menos 10 dígitos (sin contar espacios,
--    "+" ni "-").

create or replace function public.anotarse_equipo(
  p_tournament_id uuid, p_nombre_equipo text, p_jugadores jsonb, p_honeypot text default ''
) returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_tournament tournaments%rowtype;
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
  v_nombres text[] := '{}';
  v_fecha_nac date;
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

  v_nombre := trim(p_nombre_equipo);
  if v_nombre = '' or v_nombre is null then
    raise exception 'falta el nombre del equipo';
  end if;
  if v_tournament.categoria = '1v1' and v_nombre ~ '[0-9]' then
    raise exception 'el nombre no puede tener números';
  end if;

  if p_jugadores is null or jsonb_array_length(p_jugadores) = 0 then
    raise exception 'falta cargar al menos un jugador';
  end if;

  for item in select * from jsonb_array_elements(p_jugadores) loop
    v_item_name := trim(item->>'name');
    if coalesce(v_item_name, '') = '' then
      raise exception 'falta el nombre de un jugador';
    end if;
    v_alguno := true;
    if v_item_name ~ '[0-9]' then
      raise exception 'el nombre de un jugador no puede tener números';
    end if;

    if coalesce(item->>'fecha_nacimiento', '') = '' then
      raise exception 'falta la fecha de nacimiento de un jugador';
    end if;
    v_fecha_nac := (item->>'fecha_nacimiento')::date;
    if v_fecha_nac > current_date then
      raise exception 'la fecha de nacimiento no puede ser futura';
    end if;
    if extract(year from age(v_fecha_nac)) < 16 then
      raise exception 'hay que tener al menos 16 años para anotarse';
    end if;

    v_dni := nullif(trim(item->>'dni'), '');
    if v_dni is null then
      raise exception 'falta el DNI de un jugador';
    end if;
    if v_dni !~ '^[0-9]+$' then
      raise exception 'el DNI solo puede tener números';
    end if;
    if v_dni = any(v_dnis) then
      raise exception 'dos jugadores del equipo no pueden tener el mismo DNI';
    end if;
    v_dnis := array_append(v_dnis, v_dni);

    v_telefono := nullif(trim(item->>'telefono'), '');
    if v_telefono is null then
      raise exception 'falta el teléfono de un jugador';
    end if;
    if v_telefono !~ '^[0-9 +-]+$' then
      raise exception 'el teléfono solo puede tener números';
    end if;
    if length(regexp_replace(v_telefono, '[^0-9]', '', 'g')) < 10 then
      raise exception 'el teléfono de un jugador tiene que tener al menos 10 dígitos';
    end if;
    if v_telefono = any(v_telefonos) then
      raise exception 'dos jugadores del equipo no pueden tener el mismo teléfono';
    end if;
    v_telefonos := array_append(v_telefonos, v_telefono);

    v_email := lower(nullif(trim(item->>'email'), ''));
    if v_email is null then
      raise exception 'falta el mail de un jugador';
    end if;
    if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'el mail no es válido';
    end if;
    if v_email = any(v_emails) then
      raise exception 'dos jugadores del equipo no pueden tener el mismo mail';
    end if;
    v_emails := array_append(v_emails, v_email);

    v_nombres := array_append(v_nombres, split_part(v_item_name, ' ', 1));
  end loop;
  if not v_alguno then
    raise exception 'falta cargar al menos un jugador';
  end if;

  insert into teams (tournament_id, name, players, paid, pendiente_aprobacion)
  values (p_tournament_id, left(v_nombre, 80), array_to_string(v_nombres, ', '), false, true)
  returning id into v_team_id;

  for item in select * from jsonb_array_elements(p_jugadores) loop
    if coalesce(trim(item->>'name'), '') = '' then
      continue;
    end if;
    v_name_norm := lower(unaccent(trim(item->>'name')));

    select p.id into v_player_id
      from players p
      join team_players tp on tp.player_id = p.id
      join teams tm on tm.id = tp.team_id
      join tournaments t on t.id = tm.tournament_id
      where p.name_norm = v_name_norm and t.organizador_id = v_tournament.organizador_id
      limit 1;

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
