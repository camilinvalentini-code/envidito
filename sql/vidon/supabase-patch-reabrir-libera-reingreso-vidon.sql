-- Arregla: al reabrir un partido de octavos (ronda 0) en modo Vidón, si
-- el que perdía ese partido ya había sido reingresado a mano a otro
-- casillero (todavía sin jugar), quedaba pegado ahí — reabrir_cascada no
-- sabía nada del reingreso, así que no lo liberaba, y como no hay botón
-- manual para sacarlo (se sacó a propósito, ver sesión anterior), quedaba
-- sin forma de corregirlo.
--
-- Ahora, al reabrir ese partido, si el perdedor está sentado en otro
-- casillero de la ronda 0 que todavía no se jugó, se lo saca de ahí
-- automáticamente — vuelve a quedar ese casillero libre para reingresar
-- a quien corresponda.

create or replace function public.reabrir_cascada(p_match_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  max_round int;
  next_idx int;
  siguiente matches%rowtype;
  t_modo text;
  loser_id uuid;
begin
  select * into m from matches where id = p_match_id;
  if not found then return; end if;

  if m.bracket = 'grupos' then
    raise exception 'para un partido de la fase de grupos, usá reabrir_partido_grupo';
  end if;

  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments t where t.id = m.tournament_id and t.organizador_id = auth.uid())
  ) then
    raise exception 'no autorizado';
  end if;

  if m.winner_id is null then return; end if;

  select modo into t_modo from tournaments where id = m.tournament_id;

  -- Modo Vidón: si el perdedor de este partido de ronda 0 ya había sido
  -- reingresado a mano a otro casillero todavía sin jugar, se lo saca de
  -- ahí también — al reabrir el partido original, ya no corresponde que
  -- siga "reingresado" en otro lado.
  if t_modo = 'vidon' and m.bracket = 'main' and m.round_index = 0 then
    loser_id := case when m.winner_id = m.team1_id then m.team2_id else m.team1_id end;
    update matches
      set team1_id = case when team1_id = loser_id then null else team1_id end,
          team2_id = case when team2_id = loser_id then null else team2_id end
      where tournament_id = m.tournament_id
        and id <> m.id
        and winner_id is null
        and (team1_id = loser_id or team2_id = loser_id);
  end if;

  select max(round_index) into max_round from matches where tournament_id = m.tournament_id and bracket = m.bracket;

  if m.round_index = max_round then
    if m.bracket = 'main' then
      update tournaments set champion_id = null where id = m.tournament_id;
    elsif m.bracket = 'repechaje' then
      update tournaments set repechaje_champion_id = null where id = m.tournament_id;
    elsif m.bracket = 'oro' then
      update tournaments set campeon_oro_id = null where id = m.tournament_id;
    elsif m.bracket = 'plata' then
      update tournaments set campeon_plata_id = null where id = m.tournament_id;
    end if;
  else
    next_idx := m.match_index / 2;
    select * into siguiente from matches
      where tournament_id = m.tournament_id and bracket = m.bracket and round_index = m.round_index + 1 and match_index = next_idx;

    if found and siguiente.winner_id is not null then
      perform public.reabrir_cascada(siguiente.id);
    end if;

    if found then
      if m.match_index % 2 = 0 then
        update matches set team1_id = null where id = siguiente.id;
      else
        update matches set team2_id = null where id = siguiente.id;
      end if;
    end if;
  end if;

  update matches set winner_id = null where id = m.id;
end;
$$;
grant execute on function public.reabrir_cascada(uuid) to authenticated;
revoke execute on function public.reabrir_cascada(uuid) from anon;
revoke execute on function public.reabrir_cascada(uuid) from public;
