-- "Reiniciar torneo": borra todos los equipos anotados y los cruces
-- armados, y deja el torneo como recién creado (mismo nombre, fecha,
-- ubicación, categoría, puntos_max — nada de eso se toca). Pensado
-- para cuando alguien anotó equipos de prueba a mano en un torneo real
-- y quiere arrancar de cero sin tener que crear otro torneo (y sin
-- perder el link que ya compartió).
--
-- v2: el borrado de "jugadores sin equipo" de la primera versión no
-- estaba limitado a este torneo — corría sobre TODA la tabla players
-- de TODA la plataforma. No causó daño porque no había huérfanos de
-- otros torneos en ese momento, pero era un riesgo real. Ahora se
-- guarda primero la lista de jugadores de ESTE torneo puntual, y solo
-- se borran esos (y solo si además quedaron sin ningún otro equipo en
-- ningún otro torneo) — nunca toca jugadores de otro torneo u
-- organizador.
--
-- Todo pasa en una sola función (una sola transacción): o se aplica
-- todo, o no se aplica nada — no puede quedar a medias.

create or replace function public.reiniciar_torneo(p_tournament_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  t tournaments%rowtype;
  jugadores_del_torneo uuid[];
begin
  select * into t from tournaments where id = p_tournament_id for update;
  if not found then raise exception 'torneo no encontrado'; end if;

  if auth.uid() is not null and not (
    public.is_admin() or t.organizador_id = auth.uid()
  ) then
    raise exception 'no autorizado';
  end if;

  -- Guarda quiénes eran los jugadores de ESTE torneo antes de borrar
  -- nada, para poder limpiar después solo a ellos (si quedan huérfanos).
  select array_agg(distinct tp.player_id) into jugadores_del_torneo
    from team_players tp
    join teams tm on tm.id = tp.team_id
    where tm.tournament_id = p_tournament_id;

  delete from matches where tournament_id = p_tournament_id;
  delete from teams where tournament_id = p_tournament_id; -- cascada: borra team_players también

  -- Solo los que eran de este torneo, y solo si quedaron sin ningún
  -- equipo en ningún otro torneo tampoco.
  delete from players
    where id = any(coalesce(jugadores_del_torneo, array[]::uuid[]))
      and id not in (select distinct player_id from team_players);

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
