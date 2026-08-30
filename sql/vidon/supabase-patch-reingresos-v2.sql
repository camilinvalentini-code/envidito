-- Reingresos v2: el primer perdedor entra solo (por orden), y el
-- organizador puede cambiarlo tocando directamente en el cuadro.
--
-- Vuelve a activar el llenado automático que se había apagado en la
-- query 43 — en ese momento el organizador quería control 100% manual,
-- pero en la práctica resultó incómodo tener que ir a elegir a mano cada
-- vez. Ahora el primer perdedor entra solo al casillero libre, y para
-- cambiarlo el organizador lo hace directo en el cuadro (eso es un
-- cambio de pantalla, no de esta función).

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
  loser_id uuid;
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

  -- Modo Vidón: el perdedor de la ronda 0 entra solo al próximo
  -- casillero vacío, por orden. El organizador puede cambiarlo después
  -- tocando directo en el cuadro.
  if t_modo = 'vidon' and m.bracket = 'main' and m.round_index = 0 then
    loser_id := case when p_winner_id = m.team1_id then m.team2_id else m.team1_id end;
    perform public.colocar_perdedor_vidon(m.tournament_id, m.id, loser_id);
  end if;

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
