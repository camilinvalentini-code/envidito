-- Limpieza de lo que marcó el Security Advisor de Supabase.
--
-- 1) CRÍTICO: quedó viva una versión VIEJA de anotarse_equipo con 3
--    parámetros (sin el campo honeypot), de un intento anterior a que
--    armáramos el filtro de admin, las validaciones y el aislamiento por
--    organizador. Postgres permite dos funciones con el mismo nombre si
--    tienen distinta cantidad de parámetros — así que esta vieja seguía
--    respondiendo en /rest/v1/rpc/anotarse_equipo en paralelo a la nueva,
--    salteándose TODO lo que se armó en esta sesión. Se borra.
drop function if exists public.anotarse_equipo(uuid, text, jsonb);

-- 2) Tres funciones sin search_path fijo (mismo descuido que se venía
--    arrastrando de antes de esta sesión, sin relación con autoinscripción).
--    Ninguna arma SQL dinámico ni hace algo sensible, pero fijar el
--    search_path es gratis y es la misma buena práctica que ya se usa en
--    todo lo nuevo. No se toca la lógica, solo se agrega la línea.
create or replace function public.fase_de_partido(p_match_id uuid)
returns text language plpgsql stable
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  max_round int;
  faltan int;
  nombres text[] := array['final', 'semifinal', 'cuartos', 'octavos', 'dieciseisavos', 'treintaydosavos'];
begin
  select * into m from matches where id = p_match_id;
  if not found then return null; end if;
  if m.bracket = 'grupos' then return 'grupos'; end if;
  if m.bracket not in ('oro', 'plata') then return null; end if;

  select max(round_index) into max_round from matches where tournament_id = m.tournament_id and bracket = m.bracket;
  faltan := max_round - m.round_index;
  if faltan >= 0 and faltan < array_length(nombres, 1) then
    return nombres[faltan + 1];
  else
    return 'ronda ' || (m.round_index + 1);
  end if;
end;
$$;

create or replace function public.tope_de_partido(p_match_id uuid)
returns int language plpgsql stable
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  t tournaments%rowtype;
  v_fase text;
  v_tope int;
begin
  select * into m from matches where id = p_match_id;
  if not found then return 30; end if;
  select * into t from tournaments where id = m.tournament_id;

  if t.formato = 'grupos' then
    v_fase := public.fase_de_partido(m.id);
    v_tope := (t.grupos_config -> 'puntos_por_fase' ->> v_fase)::int;
  end if;

  return coalesce(v_tope, t.puntos_max, 30);
end;
$$;
grant execute on function public.tope_de_partido(uuid) to anon, authenticated;

create or replace function public.entrelazar_por_seed(p_ordenados uuid[])
returns uuid[] language plpgsql
set search_path = public, pg_temp as $$
declare
  l int := coalesce(array_length(p_ordenados, 1), 0);
  resultado uuid[] := array[]::uuid[];
  k int;
begin
  if l = 0 then return resultado; end if;
  for k in 1..ceil(l / 2.0)::int loop
    resultado := array_append(resultado, p_ordenados[k]);
    if l - k + 1 > k then
      resultado := array_append(resultado, p_ordenados[l - k + 1]);
    end if;
  end loop;
  return resultado;
end;
$$;

-- 3) handle_new_user() es una función de trigger (se dispara sola cuando
--    alguien se registra en auth.users) — nunca debería llamarse directo
--    por afuera. Sacarle el permiso de ejecución directa no rompe el
--    trigger (los triggers corren con los privilegios del dueño de la
--    función, no necesitan este permiso), solo cierra la puerta de
--    /rest/v1/rpc/handle_new_user.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
