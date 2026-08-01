-- cerrar_fase_grupos_simple ahora deja elegir cuántos de los
-- clasificados van a la Copa de Oro y cuántos a la Copa de Plata: de los
-- p_top_n que clasifican por grupo, del 1° al p_oro_hasta van a Oro y el
-- resto (p_oro_hasta+1 .. p_top_n) a Plata. Si no se manda p_oro_hasta
-- (o es igual a p_top_n), se comporta exactamente como antes: todos a
-- un solo cuadro ("Cuadro"/Copa de Oro), sin Copa de Plata.
-- generar_copas() ya sabía armar los dos cuadros a partir de
-- grupos_config.reglas — acá solo cambia cómo se arman esas reglas.

drop function if exists public.cerrar_fase_grupos_simple(uuid, int);

create or replace function public.cerrar_fase_grupos_simple(p_tournament_id uuid, p_top_n int, p_oro_hasta int default null)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  reglas jsonb;
  i int;
  oro_hasta int;
begin
  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments t where t.id = p_tournament_id and t.organizador_id = auth.uid())
  ) then
    raise exception 'no autorizado';
  end if;

  if p_top_n < 1 then
    raise exception 'tienen que clasificar al menos 1 equipo por grupo';
  end if;

  oro_hasta := coalesce(p_oro_hasta, p_top_n);
  if oro_hasta < 1 or oro_hasta > p_top_n then
    raise exception 'la cantidad que va a la Copa de Oro tiene que ser entre 1 y %', p_top_n;
  end if;

  reglas := '[]'::jsonb;
  for i in 1..p_top_n loop
    reglas := reglas || jsonb_build_array(
      jsonb_build_object('posicion', i, 'destino', case when i <= oro_hasta then 'oro' else 'plata' end)
    );
  end loop;

  update tournaments
    set grupos_config = jsonb_set(coalesce(grupos_config, '{}'::jsonb), '{reglas}', reglas)
    where id = p_tournament_id;

  perform public.generar_copas(p_tournament_id, false);
end;
$$;
revoke execute on function public.cerrar_fase_grupos_simple(uuid, int, int) from anon, public;
grant execute on function public.cerrar_fase_grupos_simple(uuid, int, int) to authenticated;
