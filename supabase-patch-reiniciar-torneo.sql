-- "Reiniciar torneo": borra todos los equipos anotados y los cruces
-- armados, y deja el torneo como recién creado (mismo nombre, fecha,
-- ubicación, categoría, puntos_max — nada de eso se toca). Pensado
-- para cuando alguien anotó equipos de prueba a mano en un torneo real
-- y quiere arrancar de cero sin tener que crear otro torneo (y sin
-- perder el link que ya compartió).
--
-- Todo pasa en una sola función (una sola transacción): o se aplica
-- todo, o no se aplica nada — no puede quedar a medias.

create or replace function public.reiniciar_torneo(p_tournament_id uuid)
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
  delete from teams where tournament_id = p_tournament_id; -- cascada: borra team_players también

  -- Jugadores que quedaron sin ningún equipo (en NINGÚN torneo) — para
  -- que no queden colgados con fechas de nacimiento falsas en la
  -- página de Cumpleaños del organizador.
  delete from players where id not in (select distinct player_id from team_players);

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
grant execute on function public.reiniciar_torneo(uuid) to authenticated;
revoke execute on function public.reiniciar_torneo(uuid) from anon;
revoke execute on function public.reiniciar_torneo(uuid) from public;
