-- Modo Vidón: botón "saltar" para un casillero de la ronda 0 que quedó
-- del todo vacío (sin ningún equipo) y ya no va a tener quién lo ocupe
-- (no quedan más perdedores para reingresar).
--
-- Hasta ahora, esos casilleros se quedaban esperando para siempre — no
-- había ningún botón para cerrarlos, así que el cuadro no podía avanzar
-- (pasa con cantidades de equipos como 20 o 21, donde el cuadro tiene
-- que ser más grande que la cantidad real de perdedores disponibles
-- para llenarlo entero).
--
-- Qué hace "saltar": borra ese casillero y, si el partido de la ronda
-- siguiente que dependía de él ya tenía el otro lado resuelto, lo hace
-- pasar directo (como un bye). Si el otro lado todavía no se jugó,
-- queda marcado para pasar directo solo apenas se resuelva, sin
-- esperar un reingreso que ya no va a llegar.
--
-- Caso repetido en la práctica: DOS casilleros vacíos seguidos (los
-- típicos "10 y 11", "12 y 13" que arma generar_bracket_vidon cuando
-- sobran matches) alimentan el MISMO partido de la ronda siguiente —
-- si se saltan los dos, ese partido de arriba queda igual de "muerto"
-- y hay que saltarlo también. _colapsar_nodo_vidon sube de ronda en
-- ronda mientras haga falta, no solo un nivel.

create or replace function public.declarar_ganador(p_match_id uuid, p_winner_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  next_m matches%rowtype;
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
  -- tocando directo en el cuadro (o saltar un casillero que ya no va a
  -- tener quién lo llene, ver saltar_casillero_vidon).
  if t_modo = 'vidon' and m.bracket = 'main' and m.round_index = 0 then
    loser_id := case when p_winner_id = m.team1_id then m.team2_id else m.team1_id end;
    if loser_id is not null then
      perform public.colocar_perdedor_vidon(m.tournament_id, m.id, loser_id);
    end if;
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

    -- Cascada de casillero saltado: si el partido de la ronda siguiente
    -- quedó marcado como bye (porque su otro origen se saltó a mano) y
    -- ahora, con este equipo, ya tiene exactamente uno solo, pasa
    -- directo sin esperar más.
    select * into next_m from matches
      where tournament_id = m.tournament_id and bracket = m.bracket and round_index = m.round_index + 1 and match_index = next_idx;
    if found and next_m.bye and next_m.winner_id is null
       and (next_m.team1_id is not null) <> (next_m.team2_id is not null) then
      perform public.declarar_ganador(next_m.id, coalesce(next_m.team1_id, next_m.team2_id));
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

-- Helper interno (no se llama directo desde afuera): borra un partido
-- que ya se sabe que nunca va a tener equipos, y sube el efecto hacia
-- el partido de la ronda siguiente. Si ese partido de arriba queda con
-- un solo equipo, pasa directo. Si queda del todo vacío Y su otro
-- origen (hermano) también fue saltado, sigue subiendo — así se
-- resuelve solo aunque haya varios casilleros vacíos seguidos.
create or replace function public._colapsar_nodo_vidon(p_match_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  next_idx int;
  next_m matches%rowtype;
  sibling_idx int;
  sibling_existe boolean;
  slot_team uuid;
begin
  select * into m from matches where id = p_match_id;
  if not found then return; end if;

  delete from matches where id = m.id;

  next_idx := m.match_index / 2;
  select * into next_m from matches
    where tournament_id = m.tournament_id and bracket = m.bracket and round_index = m.round_index + 1 and match_index = next_idx;
  if not found then
    return; -- era la final: no hay a quién avisar
  end if;

  update matches set bye = true where id = next_m.id;
  slot_team := coalesce(next_m.team1_id, next_m.team2_id);

  if slot_team is not null then
    if next_m.winner_id is null then
      perform public.declarar_ganador(next_m.id, slot_team);
    end if;
    return;
  end if;

  -- next_m sigue del todo vacío: si su otro origen (el hermano de
  -- este partido) tampoco existe más, ese partido de arriba también
  -- quedó muerto — colapsa un nivel más.
  sibling_idx := case when m.match_index % 2 = 0 then m.match_index + 1 else m.match_index - 1 end;
  select exists (
    select 1 from matches
    where tournament_id = m.tournament_id and bracket = m.bracket and round_index = m.round_index and match_index = sibling_idx
  ) into sibling_existe;

  if not sibling_existe then
    perform public._colapsar_nodo_vidon(next_m.id);
  end if;
end;
$$;
revoke execute on function public._colapsar_nodo_vidon(uuid) from anon;
revoke execute on function public._colapsar_nodo_vidon(uuid) from public;
revoke execute on function public._colapsar_nodo_vidon(uuid) from authenticated;

-- Saltar un casillero de la ronda 0 (modo Vidón) que quedó del todo
-- vacío (ni un equipo) y no va a tener quién lo ocupe. Solo se puede
-- usar en un casillero realmente vacío — si tiene un equipo esperando
-- rival, para eso ya está el botón "Nadie reingresó → pasa directo".
create or replace function public.saltar_casillero_vidon(p_match_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  t_modo text;
begin
  select * into m from matches where id = p_match_id;
  if not found then
    raise exception 'partido inexistente';
  end if;
  if m.bracket <> 'main' or m.round_index <> 0 then
    raise exception 'esto solo aplica a la primera ronda';
  end if;
  if m.winner_id is not null then
    raise exception 'ese partido ya se jugó';
  end if;
  if m.team1_id is not null or m.team2_id is not null then
    raise exception 'este casillero todavía tiene un equipo — sacalo primero si querés vaciarlo del todo';
  end if;

  select modo into t_modo from tournaments where id = m.tournament_id;
  if t_modo is distinct from 'vidon' then
    raise exception 'este torneo no está en modo Vidón';
  end if;

  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments t where t.id = m.tournament_id and t.organizador_id = auth.uid())
  ) then
    raise exception 'no autorizado';
  end if;

  perform public._colapsar_nodo_vidon(p_match_id);
end;
$$;
grant execute on function public.saltar_casillero_vidon(uuid) to authenticated;
revoke execute on function public.saltar_casillero_vidon(uuid) from anon;
revoke execute on function public.saltar_casillero_vidon(uuid) from public;
