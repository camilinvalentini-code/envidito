-- Cargar el resultado de un partido de fase de grupos a mano (con
-- puntaje real, no solo "quién ganó") — hace falta el puntaje real
-- porque la diferencia de tantos define quién clasifica.
-- Usa tope_de_partido() (de supabase-patch-modo-grupos.sql) para
-- respetar el puntos_por_fase configurado, o el puntos_max del torneo.

create or replace function public.cargar_resultado_grupo(p_match_id uuid, p_score_a int, p_score_b int)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  tope int;
  ganador uuid;
begin
  select * into m from matches where id = p_match_id;
  if not found or m.bracket != 'grupos' then
    raise exception 'ese partido no es de la fase de grupos';
  end if;

  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments t where t.id = m.tournament_id and t.organizador_id = auth.uid())
  ) then
    raise exception 'no autorizado';
  end if;

  if m.winner_id is not null then
    raise exception 'ese partido ya está cerrado';
  end if;

  tope := public.tope_de_partido(p_match_id);
  if p_score_a < 0 or p_score_a > tope or p_score_b < 0 or p_score_b > tope then
    raise exception 'los puntos van de 0 a %', tope;
  end if;
  if p_score_a = p_score_b then
    raise exception 'en truco no hay empates';
  end if;

  ganador := case when p_score_a > p_score_b then m.team1_id else m.team2_id end;
  update matches set score_a = p_score_a, score_b = p_score_b where id = p_match_id;
  perform public.declarar_ganador(p_match_id, ganador);
end;
$$;
grant execute on function public.cargar_resultado_grupo(uuid, int, int) to authenticated;
revoke execute on function public.cargar_resultado_grupo(uuid, int, int) from anon, public;
