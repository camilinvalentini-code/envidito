-- Versión simple (v1) de "cerrar la fase de grupos": clasifican los
-- primeros N de cada grupo, todos a un solo cuadro (Copa de Oro).
-- Requiere haber corrido antes supabase-patch-modo-grupos.sql (usa
-- is_admin, generar_copas, etc. de ahí).

create or replace function public.cerrar_fase_grupos_simple(p_tournament_id uuid, p_top_n int)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  reglas jsonb;
  i int;
begin
  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments t where t.id = p_tournament_id and t.organizador_id = auth.uid())
  ) then
    raise exception 'no autorizado';
  end if;

  if p_top_n < 1 then
    raise exception 'tienen que clasificar al menos 1 equipo por grupo';
  end if;

  reglas := '[]'::jsonb;
  for i in 1..p_top_n loop
    reglas := reglas || jsonb_build_array(jsonb_build_object('posicion', i, 'destino', 'oro'));
  end loop;

  update tournaments
    set grupos_config = jsonb_set(coalesce(grupos_config, '{}'::jsonb), '{reglas}', reglas)
    where id = p_tournament_id;

  perform public.generar_copas(p_tournament_id, false);
end;
$$;
revoke execute on function public.cerrar_fase_grupos_simple(uuid, int) from anon, public;
grant execute on function public.cerrar_fase_grupos_simple(uuid, int) to authenticated;
