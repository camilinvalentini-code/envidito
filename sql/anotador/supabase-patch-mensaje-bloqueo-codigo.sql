-- Cuando un partido queda bloqueado (8 códigos incorrectos seguidos),
-- validar_codigo_equipo/validar_codigo_liga devolvían solo `false` —
-- lo mismo que un código realmente incorrecto. La pantalla no tenía
-- forma de distinguir "te equivocaste" de "esperá 5 minutos", así que
-- mostraba siempre "Código incorrecto" aunque el código fuera el
-- correcto. Ahora devuelven también hasta cuándo dura el bloqueo, para
-- que la pantalla pueda avisar bien.

drop function if exists public.validar_codigo_equipo(text, text);
create or replace function public.validar_codigo_equipo(p_match_token text, p_codigo text)
returns table(ok boolean, bloqueado_hasta timestamptz) language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m matches%rowtype;
  v_ok boolean;
begin
  select * into m from matches where match_token = p_match_token;
  if not found then
    return query select false, null::timestamptz;
    return;
  end if;

  if m.bloqueado_hasta is not null and m.bloqueado_hasta > now() then
    return query select false, m.bloqueado_hasta;
    return;
  end if;

  v_ok := public.codigo_valido(m.id, p_codigo);

  if v_ok then
    return query select true, null::timestamptz;
  else
    select bloqueado_hasta into m.bloqueado_hasta from matches where id = m.id;
    return query select false, m.bloqueado_hasta;
  end if;
end;
$$;
grant execute on function public.validar_codigo_equipo(text, text) to anon, authenticated;

drop function if exists public.validar_codigo_liga(text, text);
create or replace function public.validar_codigo_liga(p_token text, p_codigo text)
returns table(ok boolean, bloqueado_hasta timestamptz) language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  p liga_partidos%rowtype;
  v_ok boolean;
begin
  select * into p from liga_partidos where match_token = p_token;
  if not found then
    return query select false, null::timestamptz;
    return;
  end if;

  if p.bloqueado_hasta is not null and p.bloqueado_hasta > now() then
    return query select false, p.bloqueado_hasta;
    return;
  end if;

  v_ok := public.codigo_valido_liga(p.id, p_codigo);

  if v_ok then
    return query select true, null::timestamptz;
  else
    select bloqueado_hasta into p.bloqueado_hasta from liga_partidos where id = p.id;
    return query select false, p.bloqueado_hasta;
  end if;
end;
$$;
grant execute on function public.validar_codigo_liga(text, text) to anon, authenticated;
