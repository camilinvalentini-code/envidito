-- Los equipos que el organizador carga a mano desde el panel
-- ("Anotar equipo") tenían el mismo problema que ya se arregló para la
-- autoinscripción: team_players quedaba bien cargado, pero
-- teams.players (el campo público) se guardaba vacío. Recalcula el
-- campo público (solo primer nombre) para cualquier equipo con
-- jugadores estructurados, sin importar cómo se haya cargado.
update teams t
set players = sub.nombres
from (
  select tp.team_id, string_agg(split_part(trim(p.name), ' ', 1), ', ' order by p.name) as nombres
  from team_players tp
  join players p on p.id = tp.player_id
  group by tp.team_id
) sub
where sub.team_id = t.id;
