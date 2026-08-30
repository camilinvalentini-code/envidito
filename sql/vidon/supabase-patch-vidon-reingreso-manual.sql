-- Modo Vidon Bar: apaga el llenado automático del casillero vacío.
--
-- Hasta ahora, declarar_ganador() colocaba automáticamente al perdedor de
-- cualquier partido de ronda 0 en el próximo casillero libre, sin
-- preguntar nada — corría antes de que el organizador llegara a decidir
-- si ESE equipo puntual quería reingresar (pagando de nuevo) o no. Con el
-- panel de "Reingresos" que ya existe en el admin, el organizador elige a
-- mano qué equipo ocupa cada casillero — así que el llenado automático
-- sobra, y de hecho competía contra la elección manual (el casillero se
-- lo comía el próximo que perdía, le tocara o no).
--
-- Este parche saca el llamado automático a colocar_perdedor_vidon() de
-- declarar_ganador(). La función colocar_perdedor_vidon() sigue existiendo
-- en la base (no molesta), simplemente ya nadie la llama sola.

create or replace function public.declarar_ganador(p_match_id uuid, p_winner_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  max_round int;
  next_idx int;
  round0_done boolean;
  t_repechaje boolean;
  t_modo text;
  existing_rep int;
  losers uuid[];
begin
  select * into m from matches where id = p_match_id;
  if not found or m.winner_id is not null then return; end if;
  if p_winner_id is distinct from m.team1_id and p_winner_id is distinct from m.team2_id then
    raise exception 'ese equipo no juega este partido';
  end if;

  if auth.uid() is not null and not (
    public.is_admin() or exists (
      select 1 from tournaments t where t.id = m.tournament_id and t.organizador_id = auth.uid()
    )
  ) then
    raise exception 'no autorizado';
  end if;

  update matches set winner_id = p_winner_id where id = p_match_id;

  select modo into t_modo from tournaments where id = m.tournament_id;

  select max(round_index) into max_round from matches where tournament_id = m.tournament_id and bracket = m.bracket;

  if m.round_index = max_round then
    if m.bracket = 'main' then
      update tournaments set champion_id = p_winner_id where id = m.tournament_id;
    elsif m.bracket = 'repechaje' then
      update tournaments set repechaje_champion_id = p_winner_id where id = m.tournament_id;
    elsif m.bracket = 'oro' then
      update tournaments set campeon_oro_id = p_winner_id where id = m.tournament_id;
    elsif m.bracket = 'plata' then
      update tournaments set campeon_plata_id = p_winner_id where id = m.tournament_id;
    end if;
  else
    next_idx := m.match_index / 2;
    if m.match_index % 2 = 0 then
      update matches set team1_id = p_winner_id
        where tournament_id = m.tournament_id and bracket = m.bracket and round_index = m.round_index + 1 and match_index = next_idx;
    else
      update matches set team2_id = p_winner_id
        where tournament_id = m.tournament_id and bracket = m.bracket and round_index = m.round_index + 1 and match_index = next_idx;
    end if;
  end if;

  -- El repechaje de siempre (llave separada) solo aplica al modo
  -- "directa" — en modo Vidon no corresponde, el reingreso se maneja a
  -- mano desde el panel del organizador.
  if t_modo = 'directa' and m.bracket = 'main' and m.round_index = 0 then
    select bool_and(winner_id is not null) into round0_done
      from matches where tournament_id = m.tournament_id and bracket = 'main' and round_index = 0;
    if round0_done then
      select repechaje into t_repechaje from tournaments where id = m.tournament_id;
      if t_repechaje then
        select count(*) into existing_rep from matches where tournament_id = m.tournament_id and bracket = 'repechaje';
        if existing_rep = 0 then
          select array_agg(case when team1_id = winner_id then team2_id else team1_id end)
            into losers
            from matches where tournament_id = m.tournament_id and bracket = 'main' and round_index = 0 and bye = false;
          if array_length(losers, 1) >= 2 then
            perform public.generar_bracket(m.tournament_id, 'repechaje', losers);
          elsif array_length(losers, 1) = 1 then
            update tournaments set repechaje_champion_id = losers[1] where id = m.tournament_id;
          end if;
        end if;
      end if;
    end if;
  end if;
end;
$$;

revoke execute on function public.declarar_ganador(uuid, uuid) from anon;
revoke execute on function public.declarar_ganador(uuid, uuid) from public;
grant execute on function public.declarar_ganador(uuid, uuid) to authenticated;
