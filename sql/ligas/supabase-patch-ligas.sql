-- LIGAS DE TRUCO — primera versión, SOLO PARA ADMIN.
-- Nada de esto es público: cada tabla tiene RLS habilitado con una sola
-- política que exige is_admin(). anon y organizadores comunes no ven nada.
-- Ejecutar completo en el SQL Editor de Supabase.

-- 1) Ligas ----------------------------------------------------------------
create table if not exists ligas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  provincia text,
  ciudad text,
  lugar text,
  categoria text not null default '1v1' check (categoria in ('1v1','2v2','3v3')),
  estructura text not null default 'apertura_clausura' check (estructura in ('apertura_clausura','unica')),
  estado text not null default 'armando' check (estado in ('armando','en_curso','finalizada')),
  organizador_id uuid references profiles(id), -- sin uso todavía, reservado para cuando se abra a organizadores
  created_at timestamptz not null default now()
);

-- 2) Equipos ----------------------------------------------------------------
create table if not exists liga_equipos (
  id uuid primary key default gen_random_uuid(),
  liga_id uuid not null references ligas(id) on delete cascade,
  nombre text not null,
  codigo text,
  created_at timestamptz not null default now()
);
create index if not exists liga_equipos_liga_id_idx on liga_equipos(liga_id);

-- 3) Etapas (Apertura / Clausura / Única) ------------------------------------
create table if not exists liga_etapas (
  id uuid primary key default gen_random_uuid(),
  liga_id uuid not null references ligas(id) on delete cascade,
  nombre text not null,
  orden int not null default 1,
  estado text not null default 'armando' check (estado in ('armando','en_curso','finalizada')),
  campeon_equipo_id uuid references liga_equipos(id),
  created_at timestamptz not null default now()
);
create index if not exists liga_etapas_liga_id_idx on liga_etapas(liga_id);

-- 4) Integrantes de cada equipo ---------------------------------------------
create table if not exists liga_integrantes (
  id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references liga_equipos(id) on delete cascade,
  nombre text not null,
  whatsapp text,
  created_at timestamptz not null default now()
);
create index if not exists liga_integrantes_equipo_id_idx on liga_integrantes(equipo_id);

-- 5) Fixture (partidos programados) ------------------------------------------
create table if not exists liga_partidos (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid not null references liga_etapas(id) on delete cascade,
  fecha_numero int not null,
  fecha_programada date,
  equipo_local_id uuid not null references liga_equipos(id),
  equipo_visitante_id uuid not null references liga_equipos(id),
  jugado boolean not null default false,
  puntos_local int,
  puntos_visitante int,
  ganador_id uuid references liga_equipos(id),
  created_at timestamptz not null default now()
);
create index if not exists liga_partidos_etapa_id_idx on liga_partidos(etapa_id);

-- 5b) Solicitudes de inscripción ("quiero inscribirme") ----------------------
-- Sin uso público todavía (nada tiene RLS abierta), pero ya queda armada
-- la tabla y las funciones de aprobar/rechazar, para no rehacer esto
-- cuando se abra la parte pública más adelante.
create table if not exists liga_solicitudes (
  id uuid primary key default gen_random_uuid(),
  liga_id uuid not null references ligas(id) on delete cascade,
  nombre_equipo text not null,
  nombre_contacto text,
  whatsapp text,
  integrantes jsonb, -- opcional: [{"nombre":"...", "whatsapp":"..."}]
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  created_at timestamptz not null default now()
);
create index if not exists liga_solicitudes_liga_id_idx on liga_solicitudes(liga_id);

-- 6) RLS: solo admin, nada público -------------------------------------------
alter table ligas enable row level security;
alter table liga_equipos enable row level security;
alter table liga_etapas enable row level security;
alter table liga_integrantes enable row level security;
alter table liga_partidos enable row level security;
alter table liga_solicitudes enable row level security;

drop policy if exists "solo admin" on ligas;
create policy "solo admin" on ligas for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "solo admin" on liga_equipos;
create policy "solo admin" on liga_equipos for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "solo admin" on liga_etapas;
create policy "solo admin" on liga_etapas for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "solo admin" on liga_integrantes;
create policy "solo admin" on liga_integrantes for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "solo admin" on liga_partidos;
create policy "solo admin" on liga_partidos for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "solo admin" on liga_solicitudes;
create policy "solo admin" on liga_solicitudes for all using (public.is_admin()) with check (public.is_admin());

-- 7) Vista: tabla de posiciones por etapa ------------------------------------
-- security_invoker hace que la vista respete el RLS de quien la consulta:
-- como las tablas de abajo son admin-only, la vista también lo es sola,
-- sin necesidad de ningún permiso extra.
create or replace view public.liga_tabla_posiciones
with (security_invoker = true) as
with resultados as (
  select p.etapa_id, p.equipo_local_id as equipo_id,
         p.puntos_local as ta, p.puntos_visitante as tc,
         (p.ganador_id = p.equipo_local_id) as gano
  from liga_partidos p where p.jugado
  union all
  select p.etapa_id, p.equipo_visitante_id as equipo_id,
         p.puntos_visitante as ta, p.puntos_local as tc,
         (p.ganador_id = p.equipo_visitante_id) as gano
  from liga_partidos p where p.jugado
)
select
  et.id as etapa_id,
  et.liga_id,
  eq.id as equipo_id,
  eq.nombre as equipo_nombre,
  count(r.equipo_id) as pj,
  count(*) filter (where r.gano) as pg,
  count(*) filter (where r.gano = false) as pp,
  coalesce(sum(r.ta), 0) - coalesce(sum(r.tc), 0) as dif,
  coalesce(sum(r.ta), 0) as ta,
  coalesce(sum(r.tc), 0) as tc
from liga_etapas et
join liga_equipos eq on eq.liga_id = et.liga_id
left join resultados r on r.etapa_id = et.id and r.equipo_id = eq.id
group by et.id, et.liga_id, eq.id, eq.nombre;

-- 8) Vista: tabla acumulada de toda la liga (todas las etapas juntas) -------
create or replace view public.liga_tabla_acumulada
with (security_invoker = true) as
with resultados as (
  select et.liga_id, p.equipo_local_id as equipo_id,
         p.puntos_local as ta, p.puntos_visitante as tc,
         (p.ganador_id = p.equipo_local_id) as gano
  from liga_partidos p join liga_etapas et on et.id = p.etapa_id where p.jugado
  union all
  select et.liga_id, p.equipo_visitante_id as equipo_id,
         p.puntos_visitante as ta, p.puntos_local as tc,
         (p.ganador_id = p.equipo_visitante_id) as gano
  from liga_partidos p join liga_etapas et on et.id = p.etapa_id where p.jugado
)
select
  eq.liga_id,
  eq.id as equipo_id,
  eq.nombre as equipo_nombre,
  count(r.equipo_id) as pj,
  count(*) filter (where r.gano) as pg,
  count(*) filter (where r.gano = false) as pp,
  coalesce(sum(r.ta), 0) - coalesce(sum(r.tc), 0) as dif,
  coalesce(sum(r.ta), 0) as ta,
  coalesce(sum(r.tc), 0) as tc
from liga_equipos eq
left join resultados r on r.liga_id = eq.liga_id and r.equipo_id = eq.id
group by eq.liga_id, eq.id, eq.nombre;

-- 9) Función: crear liga (y sus etapas) --------------------------------------
create or replace function public.crear_liga(
  p_nombre text, p_provincia text, p_ciudad text, p_lugar text,
  p_categoria text, p_estructura text
) returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  insert into ligas (nombre, provincia, ciudad, lugar, categoria, estructura)
  values (p_nombre, p_provincia, p_ciudad, p_lugar, p_categoria, p_estructura)
  returning id into v_id;

  if p_estructura = 'apertura_clausura' then
    insert into liga_etapas (liga_id, nombre, orden) values
      (v_id, 'Apertura', 1),
      (v_id, 'Clausura', 2);
  else
    insert into liga_etapas (liga_id, nombre, orden) values (v_id, 'Única', 1);
  end if;

  return v_id;
end;
$$;
revoke execute on function public.crear_liga(text, text, text, text, text, text) from anon, public;
grant execute on function public.crear_liga(text, text, text, text, text, text) to authenticated;

-- 10) Función: agregar equipo con sus integrantes ----------------------------
-- p_integrantes: jsonb array, ej: [{"nombre":"Juan","whatsapp":"3493..."}]
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
    v_codigo := lpad(floor(random() * 10000)::int::text, 4, '0');
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
revoke execute on function public.agregar_equipo_liga(uuid, text, jsonb) from anon, public;
grant execute on function public.agregar_equipo_liga(uuid, text, jsonb) to authenticated;

-- 11) Función: generar fixture todos-contra-todos (método del círculo) ------
create or replace function public.generar_fixture_liga(p_etapa_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_liga_id uuid;
  equipos uuid[];
  n int;
  rounds int;
  i int;
  r int;
  a uuid;
  b uuid;
  arr uuid[];
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  select liga_id into v_liga_id from liga_etapas where id = p_etapa_id;
  if v_liga_id is null then
    raise exception 'etapa inexistente';
  end if;

  delete from liga_partidos where etapa_id = p_etapa_id;

  select array_agg(id order by random()) into equipos from liga_equipos where liga_id = v_liga_id;
  n := coalesce(array_length(equipos, 1), 0);
  if n < 2 then
    raise exception 'hacen falta al menos 2 equipos para armar el fixture';
  end if;

  if n % 2 = 1 then
    equipos := equipos || null::uuid; -- equipo libre en las fechas impares
    n := n + 1;
  end if;

  rounds := n - 1;
  arr := equipos;

  for r in 0..rounds - 1 loop
    for i in 0..(n / 2) - 1 loop
      a := arr[i + 1];
      b := arr[n - i];
      if a is not null and b is not null then
        insert into liga_partidos (etapa_id, fecha_numero, equipo_local_id, equipo_visitante_id)
        values (p_etapa_id, r + 1, a, b);
      end if;
    end loop;
    arr := array[arr[1]] || arr[n:n] || arr[2:n-1];
  end loop;
end;
$$;
revoke execute on function public.generar_fixture_liga(uuid) from anon, public;
grant execute on function public.generar_fixture_liga(uuid) to authenticated;

-- 12) Función: cargar (o corregir) el resultado de un partido ----------------
create or replace function public.cargar_resultado_liga(
  p_partido_id uuid, p_puntos_local int, p_puntos_visitante int
) returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  p liga_partidos%rowtype;
  v_ganador uuid;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  select * into p from liga_partidos where id = p_partido_id;
  if not found then
    raise exception 'partido inexistente';
  end if;
  if p_puntos_local = p_puntos_visitante then
    raise exception 'en truco no hay empates, un resultado tiene que tener ganador';
  end if;

  v_ganador := case when p_puntos_local > p_puntos_visitante then p.equipo_local_id else p.equipo_visitante_id end;

  update liga_partidos
    set puntos_local = p_puntos_local,
        puntos_visitante = p_puntos_visitante,
        ganador_id = v_ganador,
        jugado = true
    where id = p_partido_id;
end;
$$;
revoke execute on function public.cargar_resultado_liga(uuid, int, int) from anon, public;
grant execute on function public.cargar_resultado_liga(uuid, int, int) to authenticated;

-- 13) Función: crear una solicitud (por ahora la usás vos mismo desde el
-- panel de admin para probar cómo se ve la pestaña; el día que exista el
-- formulario público, esta misma función se abre a "anon").
create or replace function public.crear_solicitud_liga(
  p_liga_id uuid, p_nombre_equipo text, p_nombre_contacto text, p_whatsapp text
) returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  insert into liga_solicitudes (liga_id, nombre_equipo, nombre_contacto, whatsapp)
  values (p_liga_id, p_nombre_equipo, p_nombre_contacto, p_whatsapp)
  returning id into v_id;

  return v_id;
end;
$$;
revoke execute on function public.crear_solicitud_liga(uuid, text, text, text) from anon, public;
grant execute on function public.crear_solicitud_liga(uuid, text, text, text) to authenticated;

-- 14) Función: aprobar solicitud → crea el equipo automáticamente -----------
create or replace function public.aprobar_solicitud_liga(p_solicitud_id uuid)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  s liga_solicitudes%rowtype;
  v_equipo_id uuid;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  select * into s from liga_solicitudes where id = p_solicitud_id;
  if not found then
    raise exception 'solicitud inexistente';
  end if;
  if s.estado <> 'pendiente' then
    raise exception 'esa solicitud ya fue procesada';
  end if;

  v_equipo_id := public.agregar_equipo_liga(s.liga_id, s.nombre_equipo, s.integrantes);

  update liga_solicitudes set estado = 'aprobada' where id = p_solicitud_id;

  return v_equipo_id;
end;
$$;
revoke execute on function public.aprobar_solicitud_liga(uuid) from anon, public;
grant execute on function public.aprobar_solicitud_liga(uuid) to authenticated;

-- 15) Función: rechazar solicitud --------------------------------------------
create or replace function public.rechazar_solicitud_liga(p_solicitud_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  update liga_solicitudes set estado = 'rechazada'
    where id = p_solicitud_id and estado = 'pendiente';
end;
$$;
revoke execute on function public.rechazar_solicitud_liga(uuid) from anon, public;
grant execute on function public.rechazar_solicitud_liga(uuid) to authenticated;

-- 16) Función: editar un equipo ya creado (nombre + reemplaza integrantes) --
create or replace function public.editar_equipo_liga(
  p_equipo_id uuid, p_nombre text, p_integrantes jsonb
) returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  item jsonb;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  update liga_equipos set nombre = p_nombre where id = p_equipo_id;

  delete from liga_integrantes where equipo_id = p_equipo_id;

  if p_integrantes is not null then
    for item in select * from jsonb_array_elements(p_integrantes) loop
      insert into liga_integrantes (equipo_id, nombre, whatsapp)
      values (p_equipo_id, item->>'nombre', item->>'whatsapp');
    end loop;
  end if;
end;
$$;
revoke execute on function public.editar_equipo_liga(uuid, text, jsonb) from anon, public;
grant execute on function public.editar_equipo_liga(uuid, text, jsonb) to authenticated;

-- 17) Función: eliminar un equipo (y sus partidos programados con él) -------
create or replace function public.eliminar_equipo_liga(p_equipo_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  update liga_etapas set campeon_equipo_id = null where campeon_equipo_id = p_equipo_id;
  delete from liga_partidos where equipo_local_id = p_equipo_id or equipo_visitante_id = p_equipo_id;
  delete from liga_equipos where id = p_equipo_id;
end;
$$;
revoke execute on function public.eliminar_equipo_liga(uuid) from anon, public;
grant execute on function public.eliminar_equipo_liga(uuid) to authenticated;
