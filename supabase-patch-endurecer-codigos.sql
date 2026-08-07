-- Auditoría de seguridad 2026-08-07 — parche de endurecimiento:
--
-- 1) Códigos de equipo (torneo y liga) pasan de 4 a 6 dígitos: 10.000
--    combinaciones eran pocas para probar por fuerza bruta sin límite de
--    intentos; 1.000.000 ya no es práctico incluso sin el punto 2.
-- 2) Límite de intentos: después de 8 códigos incorrectos seguidos contra
--    el mismo partido, se bloquea 5 minutos antes de aceptar más intentos
--    (para cualquiera de los dos equipos de ese partido — es un trade-off
--    simple: si alguien ataca un partido, ese partido puntual queda
--    bloqueado un rato, no el torneo entero). Un código correcto resetea
--    el contador, así que a un equipo que se equivoca de casualidad no le
--    pasa nada.
-- 3) La política de INSERT en `players` se llamaba "dueño o admin crea
--    players" pero en los hechos dejaba pasar cualquier cosa (with check
--    (true)). Ahora exige sesión iniciada, que es como se usa en la app
--    de verdad (el autocompletado de jugadores vive en el panel del
--    organizador, siempre logueado).

-- ── 1) Códigos de 6 dígitos ────────────────────────────────────────────

create or replace function public.generar_codigo_equipo(p_tournament_id uuid)
returns text language plpgsql
set search_path = public, pg_temp as $$
declare
  nuevo text;
  intentos int := 0;
begin
  loop
    nuevo := lpad(floor(random() * 1000000)::int::text, 6, '0');
    intentos := intentos + 1;
    exit when intentos > 30 or not exists (
      select 1 from teams where tournament_id = p_tournament_id and codigo = nuevo
    );
  end loop;
  return nuevo;
end;
$$;

create or replace function public.agregar_equipo_liga(
  p_liga_id uuid, p_nombre text, p_integrantes jsonb
) returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_equipo_id uuid;
  v_codigo text;
  v_intentos int := 0;
  item jsonb;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  loop
    v_codigo := lpad(floor(random() * 1000000)::int::text, 6, '0');
    v_intentos := v_intentos + 1;
    exit when v_intentos > 30 or not exists (
      select 1 from liga_equipos where liga_id = p_liga_id and codigo = v_codigo
    );
  end loop;

  insert into liga_equipos (liga_id, nombre, codigo)
  values (p_liga_id, p_nombre, v_codigo)
  returning id into v_equipo_id;

  if p_integrantes is not null then
    for item in select * from jsonb_array_elements(p_integrantes) loop
      insert into liga_integrantes (equipo_id, nombre, whatsapp)
      values (v_equipo_id, item->>'nombre', item->>'whatsapp');
    end loop;
  end if;

  return v_equipo_id;
end;
$$;

-- ── 2) Límite de intentos ──────────────────────────────────────────────

alter table matches add column if not exists intentos_codigo int not null default 0;
alter table matches add column if not exists bloqueado_hasta timestamptz;
alter table liga_partidos add column if not exists intentos_codigo int not null default 0;
alter table liga_partidos add column if not exists bloqueado_hasta timestamptz;

create or replace function public.codigo_valido(p_match_id uuid, p_codigo text)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  c1 text;
  c2 text;
  ok boolean;
begin
  if p_codigo is null or length(trim(p_codigo)) = 0 then return false; end if;
  select * into m from matches where id = p_match_id;
  if not found then return false; end if;

  if m.bloqueado_hasta is not null and m.bloqueado_hasta > now() then
    return false;
  end if;

  select codigo into c1 from teams where id = m.team1_id;
  select codigo into c2 from teams where id = m.team2_id;
  ok := p_codigo = c1 or p_codigo = c2;

  if ok then
    update matches set intentos_codigo = 0, bloqueado_hasta = null where id = p_match_id;
  else
    update matches set
      intentos_codigo = intentos_codigo + 1,
      bloqueado_hasta = case when intentos_codigo + 1 >= 8 then now() + interval '5 minutes' else bloqueado_hasta end
    where id = p_match_id;
  end if;

  return ok;
end;
$$;

create or replace function public.codigo_valido_liga(p_partido_id uuid, p_codigo text)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  p liga_partidos%rowtype;
  c1 text;
  c2 text;
  ok boolean;
begin
  if p_codigo is null or length(trim(p_codigo)) = 0 then return false; end if;
  select * into p from liga_partidos where id = p_partido_id;
  if not found then return false; end if;

  if p.bloqueado_hasta is not null and p.bloqueado_hasta > now() then
    return false;
  end if;

  select codigo into c1 from liga_equipos where id = p.equipo_local_id;
  select codigo into c2 from liga_equipos where id = p.equipo_visitante_id;
  ok := p_codigo = c1 or p_codigo = c2;

  if ok then
    update liga_partidos set intentos_codigo = 0, bloqueado_hasta = null where id = p_partido_id;
  else
    update liga_partidos set
      intentos_codigo = intentos_codigo + 1,
      bloqueado_hasta = case when intentos_codigo + 1 >= 8 then now() + interval '5 minutes' else bloqueado_hasta end
    where id = p_partido_id;
  end if;

  return ok;
end;
$$;

-- ── 3) Política de players ──────────────────────────────────────────────

drop policy if exists "dueño o admin crea players" on players;
create policy "organizador con sesión crea players" on players for insert
  with check (auth.uid() is not null);
