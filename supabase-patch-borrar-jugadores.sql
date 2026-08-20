-- Permite al organizador borrar un jugador de su propio torneo (hoy solo
-- podía ver y editar, no borrar). Mismo criterio de las políticas de
-- lectura/edición: dueño de un torneo donde ese jugador está anotado, o
-- admin. team_players.player_id ya tiene "on delete cascade", así que
-- borrar el jugador también saca su fila de team_players sola, sin dejar
-- referencias colgadas.

drop policy if exists "organizador borra sus jugadores" on players;
create policy "organizador borra sus jugadores" on players for delete
  using (
    public.is_admin() or exists (
      select 1 from team_players tp
      join teams tm on tm.id = tp.team_id
      join tournaments t on t.id = tm.tournament_id
      where tp.player_id = players.id and t.organizador_id = auth.uid()
    )
  );
