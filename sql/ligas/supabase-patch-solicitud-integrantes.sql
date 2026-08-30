-- crear_solicitud_liga ahora también guarda los nombres de los
-- integrantes (antes esa columna quedaba siempre en null, así que al
-- aprobar una solicitud el equipo se creaba sin nadie adentro).

drop function if exists public.crear_solicitud_liga(uuid, text, text, text);

create or replace function public.crear_solicitud_liga(
  p_liga_id uuid, p_nombre_equipo text, p_nombre_contacto text, p_whatsapp text, p_integrantes jsonb default null
) returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  insert into liga_solicitudes (liga_id, nombre_equipo, nombre_contacto, whatsapp, integrantes)
  values (p_liga_id, p_nombre_equipo, p_nombre_contacto, p_whatsapp, p_integrantes)
  returning id into v_id;

  return v_id;
end;
$$;
revoke execute on function public.crear_solicitud_liga(uuid, text, text, text, jsonb) from anon, public;
grant execute on function public.crear_solicitud_liga(uuid, text, text, text, jsonb) to authenticated;
