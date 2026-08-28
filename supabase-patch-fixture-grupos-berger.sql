-- Arreglo de fondo del sorteo de la fase de grupos.
--
-- Se detectó un caso real donde el fixture (todos contra todos) armaba
-- un partido de un equipo CONTRA SÍ MISMO — el método anterior
-- reconstruía un array a mano en cada ronda (rotación) y en algún caso
-- de tamaño de grupo terminaba repitiendo un equipo en dos posiciones.
-- No se pudo aislar el caso exacto a mano, así que en vez de parchear
-- el método viejo, se reemplaza por el "método de Berger": el clásico
-- para armar todos-contra-todos, con aritmética modular (sin
-- reconstruir arrays), mucho más fácil de verificar y con menos
-- superficie para casos borde.
--
-- Además:
--   - Ahora solo entran al sorteo los equipos APROBADOS (antes entraba
--     cualquiera, incluidos los que están anotados pero todavía no
--     confirmaron asistencia) — mismo criterio que ya usa el cuadro
--     directo.
--   - Al final de armar cada grupo, se verifica que haya exactamente
--     la cantidad de partidos esperada (todos contra todos, una vez
--     cada uno, sin repetidos) — si algo no cierra, se aborta TODO el
--     sorteo (no queda nada a medio guardar) y tira un error claro, en
--     vez de dejar un fixture roto funcionando en un torneo real.

create or replace function public.generar_fase_grupos(p_tournament_id uuid, p_cantidad_grupos int)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  jugados int;
  equipos uuid[];
  n int;
  i int;
  g record;
  grupo_equipos uuid[];
  n_grupo int;
  n_real int;
  ronda int;
  mitad int;
  idx_a int;
  idx_b int;
  pos_a int;
  pos_b int;
  t1 uuid;
  t2 uuid;
  match_idx int;
  esperados int;
  creados int;
begin
  if auth.uid() is not null and not (
    public.is_admin() or exists (select 1 from tournaments t where t.id = p_tournament_id and t.organizador_id = auth.uid())
  ) then
    raise exception 'no autorizado';
  end if;

  if p_cantidad_grupos < 1 then
    raise exception 'la cantidad de grupos tiene que ser al menos 1';
  end if;

  select count(*) into jugados from matches
    where tournament_id = p_tournament_id and bracket = 'grupos' and winner_id is not null;
  if jugados > 0 then
    raise exception 'ya hay partidos de grupos jugados — no se puede volver a sortear';
  end if;

  delete from matches where tournament_id = p_tournament_id and bracket = 'grupos';
  update teams set grupo = null where tournament_id = p_tournament_id;

  select array_agg(id order by random()) into equipos
    from teams where tournament_id = p_tournament_id and not pendiente_aprobacion;
  n := coalesce(array_length(equipos, 1), 0);
  if n < p_cantidad_grupos * 2 then
    raise exception 'hacen falta al menos % equipos aprobados para % grupos', p_cantidad_grupos * 2, p_cantidad_grupos;
  end if;

  for i in 1..n loop
    update teams set grupo = ((i - 1) % p_cantidad_grupos) + 1 where id = equipos[i];
  end loop;

  for g in
    select grupo, array_agg(id order by random()) as ids
    from teams where tournament_id = p_tournament_id and grupo is not null
    group by grupo
  loop
    grupo_equipos := g.ids;
    n_real := array_length(grupo_equipos, 1);
    n_grupo := n_real;
    if n_grupo % 2 = 1 then
      grupo_equipos := array_append(grupo_equipos, null);
      n_grupo := n_grupo + 1;
    end if;
    mitad := n_grupo / 2;
    creados := 0;

    -- Método de Berger: la posición n_grupo (la última) queda fija;
    -- las demás (1..n_grupo-1) van rotando con aritmética modular. En
    -- cada ronda, la posición fija juega contra "ronda+1", y el resto
    -- se empareja de a pares simétricos alrededor de esa rotación.
    for ronda in 0..n_grupo - 2 loop
      match_idx := 0;
      for i in 0..mitad - 1 loop
        if i = 0 then
          pos_a := n_grupo;
          pos_b := ronda + 1;
        else
          idx_a := (ronda + i) % (n_grupo - 1);
          idx_b := (ronda - i + (n_grupo - 1)) % (n_grupo - 1);
          pos_a := idx_a + 1;
          pos_b := idx_b + 1;
        end if;
        t1 := grupo_equipos[pos_a];
        t2 := grupo_equipos[pos_b];
        if t1 is not null and t2 is not null then
          if t1 = t2 then
            raise exception 'error armando el grupo % (equipo repetido contra sí mismo) — avisale a Camilo', g.grupo;
          end if;
          insert into matches (tournament_id, bracket, grupo, round_index, match_index, team1_id, team2_id, bye, match_token)
          values (p_tournament_id, 'grupos', g.grupo, ronda, match_idx, t1, t2, false, encode(gen_random_bytes(8), 'hex'));
          match_idx := match_idx + 1;
          creados := creados + 1;
        end if;
      end loop;
    end loop;

    esperados := n_real * (n_real - 1) / 2;
    if creados != esperados then
      raise exception 'error armando el grupo % (esperaba % partidos, se armaron %) — avisale a Camilo', g.grupo, esperados, creados;
    end if;
    if exists (
      select 1 from (
        select team1_id, team2_id from matches
        where tournament_id = p_tournament_id and bracket = 'grupos' and grupo = g.grupo
        group by team1_id, team2_id
        having count(*) > 1
      ) dup
    ) then
      raise exception 'error armando el grupo % (partido repetido) — avisale a Camilo', g.grupo;
    end if;
  end loop;

  update tournaments set
    formato = 'grupos',
    grupos_config = jsonb_set(coalesce(grupos_config, '{}'::jsonb), '{cantidad_grupos}', to_jsonb(p_cantidad_grupos)),
    grupos_generados = true
  where id = p_tournament_id;
end;
$$;
grant execute on function public.generar_fase_grupos(uuid, int) to authenticated;
revoke execute on function public.generar_fase_grupos(uuid, int) from anon;
revoke execute on function public.generar_fase_grupos(uuid, int) from public;
