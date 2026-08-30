-- Anotador público para partidos de liga, con código por equipo —
-- misma lógica que ya usan los torneos (anotar_punto/proponer_cierre/
-- confirmar_cierre/cancelar_cierre), adaptada a liga_partidos.
-- El resto de Liga sigue siendo admin-only: esto SOLO expone, por
-- partido puntual (vía su match_token), el marcador de ESE partido —
-- nada de la tabla de posiciones, otros equipos, ni el resto de la liga.

alter table liga_partidos add column if not exists match_token text;
alter table liga_partidos add column if not exists confirmacion_pendiente boolean not null default false;
alter table liga_partidos add column if not exists lado_propuesto text;
alter table liga_partidos add column if not exists confirmaciones int not null default 0;

-- Backfill: a los partidos que ya existían antes de este patch, generarles token.
update liga_partidos set match_token = encode(gen_random_bytes(8), 'hex') where match_token is null;

-- generar_fixture_liga: ahora también le pone match_token a cada partido.
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
        insert into liga_partidos (etapa_id, fecha_numero, equipo_local_id, equipo_visitante_id, match_token)
        values (p_etapa_id, r + 1, a, b, encode(gen_random_bytes(8), 'hex'));
      end if;
    end loop;
    arr := array[arr[1]] || arr[n:n] || arr[2:n-1];
  end loop;
end;
$$;
revoke execute on function public.generar_fixture_liga(uuid) from anon, public;
grant execute on function public.generar_fixture_liga(uuid) to authenticated;

-- Helper interno: ¿el código sirve para ESTE partido de liga puntual?
create or replace function public.codigo_valido_liga(p_partido_id uuid, p_codigo text)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  p liga_partidos%rowtype;
  c1 text;
  c2 text;
begin
  if p_codigo is null or length(trim(p_codigo)) = 0 then return false; end if;
  select * into p from liga_partidos where id = p_partido_id;
  if not found then return false; end if;
  select codigo into c1 from liga_equipos where id = p.equipo_local_id;
  select codigo into c2 from liga_equipos where id = p.equipo_visitante_id;
  return p_codigo = c1 or p_codigo = c2;
end;
$$;

-- La usa la pantalla del anotador para validar el código sin revelar nada.
create or replace function public.validar_codigo_liga(p_token text, p_codigo text)
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  p liga_partidos%rowtype;
begin
  select * into p from liga_partidos where match_token = p_token;
  if not found then return false; end if;
  return public.codigo_valido_liga(p.id, p_codigo);
end;
$$;
grant execute on function public.validar_codigo_liga(text, text) to anon, authenticated;

-- Trae lo que necesita la pantalla del anotador para ESE partido: sin
-- código no revela nada más que esto (nombres de los dos equipos y el
-- marcador de este partido puntual).
create or replace function public.partido_liga_por_token(p_token text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  p liga_partidos%rowtype;
  eq_l liga_equipos%rowtype;
  eq_v liga_equipos%rowtype;
  l ligas%rowtype;
  et liga_etapas%rowtype;
begin
  select * into p from liga_partidos where match_token = p_token;
  if not found then return null; end if;
  select * into eq_l from liga_equipos where id = p.equipo_local_id;
  select * into eq_v from liga_equipos where id = p.equipo_visitante_id;
  select * into et from liga_etapas where id = p.etapa_id;
  select * into l from ligas where id = et.liga_id;

  return jsonb_build_object(
    'id', p.id,
    'fecha_numero', p.fecha_numero,
    'jugado', p.jugado,
    'puntos_local', coalesce(p.puntos_local, 0),
    'puntos_visitante', coalesce(p.puntos_visitante, 0),
    'ganador_id', p.ganador_id,
    'confirmacion_pendiente', p.confirmacion_pendiente,
    'lado_propuesto', p.lado_propuesto,
    'confirmaciones', p.confirmaciones,
    'equipo_local_id', p.equipo_local_id,
    'equipo_visitante_id', p.equipo_visitante_id,
    'equipo_local_nombre', eq_l.nombre,
    'equipo_visitante_nombre', eq_v.nombre,
    'liga_nombre', l.nombre,
    'etapa_nombre', et.nombre
  );
end;
$$;
grant execute on function public.partido_liga_por_token(text) to anon, authenticated;

-- Suma o resta un punto. Al llegar a 30 no cierra solo: eso lo maneja
-- proponer_cierre_liga/confirmar_cierre_liga, igual que en los torneos
-- (hace falta que confirmen las dos mesas).
create or replace function public.anotar_punto_liga(p_token text, p_lado text, p_delta int, p_codigo text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  p liga_partidos%rowtype;
  nuevo int;
begin
  select * into p from liga_partidos where match_token = p_token;
  if not found then raise exception 'partido no encontrado'; end if;
  if not public.codigo_valido_liga(p.id, p_codigo) then raise exception 'código inválido'; end if;
  if p.jugado then return public.partido_liga_por_token(p_token); end if;

  if p_lado = 'A' then
    nuevo := greatest(0, least(30, coalesce(p.puntos_local, 0) + p_delta));
    update liga_partidos set puntos_local = nuevo where id = p.id;
  else
    nuevo := greatest(0, least(30, coalesce(p.puntos_visitante, 0) + p_delta));
    update liga_partidos set puntos_visitante = nuevo where id = p.id;
  end if;

  return public.partido_liga_por_token(p_token);
end;
$$;
grant execute on function public.anotar_punto_liga(text, text, int, text) to anon, authenticated;

create or replace function public.proponer_cierre_liga(p_token text, p_lado text, p_codigo text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  p liga_partidos%rowtype;
begin
  select * into p from liga_partidos where match_token = p_token;
  if not found then raise exception 'partido no encontrado'; end if;
  if not public.codigo_valido_liga(p.id, p_codigo) then raise exception 'código inválido'; end if;
  if p.jugado then return public.partido_liga_por_token(p_token); end if;
  update liga_partidos set confirmacion_pendiente = true, lado_propuesto = p_lado, confirmaciones = 1 where id = p.id;
  return public.partido_liga_por_token(p_token);
end;
$$;
grant execute on function public.proponer_cierre_liga(text, text, text) to anon, authenticated;

create or replace function public.confirmar_cierre_liga(p_token text, p_codigo text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  p liga_partidos%rowtype;
  ganador uuid;
begin
  select * into p from liga_partidos where match_token = p_token;
  if not found then raise exception 'partido no encontrado'; end if;
  if not public.codigo_valido_liga(p.id, p_codigo) then raise exception 'código inválido'; end if;
  if p.jugado then return public.partido_liga_por_token(p_token); end if;
  if not p.confirmacion_pendiente then return public.partido_liga_por_token(p_token); end if;

  update liga_partidos set confirmaciones = confirmaciones + 1 where id = p.id;
  select * into p from liga_partidos where id = p.id;

  if p.confirmaciones < 2 then
    return public.partido_liga_por_token(p_token);
  end if;

  if p.lado_propuesto = 'A' then
    ganador := p.equipo_local_id;
    update liga_partidos set puntos_local = 30, jugado = true, ganador_id = ganador,
      confirmacion_pendiente = false, lado_propuesto = null
      where id = p.id;
  else
    ganador := p.equipo_visitante_id;
    update liga_partidos set puntos_visitante = 30, jugado = true, ganador_id = ganador,
      confirmacion_pendiente = false, lado_propuesto = null
      where id = p.id;
  end if;

  return public.partido_liga_por_token(p_token);
end;
$$;
grant execute on function public.confirmar_cierre_liga(text, text) to anon, authenticated;

create or replace function public.cancelar_cierre_liga(p_token text, p_codigo text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  p liga_partidos%rowtype;
begin
  select * into p from liga_partidos where match_token = p_token;
  if not found then raise exception 'partido no encontrado'; end if;
  if not public.codigo_valido_liga(p.id, p_codigo) then raise exception 'código inválido'; end if;
  update liga_partidos set confirmacion_pendiente = false, lado_propuesto = null, confirmaciones = 0 where id = p.id;
  return public.partido_liga_por_token(p_token);
end;
$$;
grant execute on function public.cancelar_cierre_liga(text, text) to anon, authenticated;
