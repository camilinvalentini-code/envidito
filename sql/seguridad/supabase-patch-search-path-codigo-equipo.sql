-- Corrige el warning "Function Search Path Mutable" del Security Advisor
-- para estas dos funciones. Misma lógica, solo se les fija el search_path.
-- Seguro de correr las veces que hagan falta, no cambia datos.

create or replace function public.generar_codigo_equipo(p_tournament_id uuid)
returns text language plpgsql
set search_path = public, pg_temp as $$
declare
  nuevo text;
  intentos int := 0;
begin
  loop
    nuevo := lpad(floor(random() * 10000)::int::text, 4, '0');
    intentos := intentos + 1;
    exit when intentos > 30 or not exists (
      select 1 from teams where tournament_id = p_tournament_id and codigo = nuevo
    );
  end loop;
  return nuevo;
end;
$$;

create or replace function public.trg_set_codigo_equipo()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  if new.codigo is null then
    new.codigo := public.generar_codigo_equipo(new.tournament_id);
  end if;
  return new;
end;
$$;
