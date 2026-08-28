-- "Reiniciar sorteo": a diferencia de reiniciar_torneo (que borra TODO,
-- incluidos los equipos), esto mantiene los equipos anotados tal cual
-- están (nombres, códigos, jugadores, todo) y solo borra los cruces y
-- resultados armados, dejando el torneo como recién a punto de
-- sortear. Para el caso de "cargué los equipos reales pero el sorteo
-- salió mal / quiero probar otro formato" — sin tener que volver a
-- anotar a nadie.

create or replace function public.reiniciar_sorteo(p_tournament_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  t tournaments%rowtype;
begin
  select * into t from tournaments where id = p_tournament_id for update;
  if not found then raise exception 'torneo no encontrado'; end if;

  if auth.uid() is not null and not (
    public.is_admin() or t.organizador_id = auth.uid()
  ) then
    raise exception 'no autorizado';
  end if;

  delete from matches where tournament_id = p_tournament_id;
  update teams set grupo = null where tournament_id = p_tournament_id;

  update tournaments set
    formato = 'directa',
    grupos_generados = false,
    copas_generadas = false,
    clasificatoria_generada = false,
    clasificatoria_cerrada = false,
    started = false,
    champion_id = null,
    repechaje_champion_id = null,
    campeon_oro_id = null,
    campeon_plata_id = null,
    grupos_config = '{}'::jsonb
  where id = p_tournament_id;
end;
$$;
grant execute on function public.reiniciar_sorteo(uuid) to authenticated;
revoke execute on function public.reiniciar_sorteo(uuid) from anon;
revoke execute on function public.reiniciar_sorteo(uuid) from public;
