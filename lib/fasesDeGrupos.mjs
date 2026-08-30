// No se importa `shuffle` de ./bracket.js a propósito: ese archivo es
// CommonJS de hecho (no hay "type": "module" en package.json), así que un
// .mjs no puede importarlo con `import` sin romperse. Es la misma función
// de siempre (Fisher-Yates), copiada acá para no tocar bracket.js.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Reparto de equipos en N grupos ──────────────────────────────────────
   Al azar, lo más parejo posible (round-robin de asignación: el grupo 1
   recibe el primero, el 2 el segundo, ... y vuelve a empezar). */
export function repartirEnGrupos(teamIds, cantidadGrupos) {
  const mezclados = shuffle(teamIds);
  const grupos = Array.from({ length: cantidadGrupos }, () => []);
  mezclados.forEach((id, i) => {
    grupos[i % cantidadGrupos].push(id);
  });
  return grupos; // grupos[0] = ids del grupo 1, grupos[1] = ids del grupo 2, ...
}

/* ── Fixture de un grupo: Circle Method (algoritmo de rotación) ──────────
   Determinístico a partir de un solo shuffle inicial — nada de random()
   evaluándose más de una vez, que fue la causa real de todos los bugs
   viejos. Da la cantidad mínima de fechas: N-1 si N es par, N si es impar
   (con un descanso rotativo, representado acá como `null`).
   Devuelve [{ fecha, team1Id, team2Id }], fecha arrancando en 0. */
export function armarFixtureGrupo(teamIds) {
  const equipos = shuffle(teamIds);
  const conDescanso = equipos.length % 2 !== 0;
  const lista = conDescanso ? [...equipos, null] : [...equipos];
  const n = lista.length;
  const fechas = n - 1;
  const partidos = [];
  let actual = lista;

  for (let fecha = 0; fecha < fechas; fecha++) {
    for (let i = 0; i < n / 2; i++) {
      const a = actual[i];
      const b = actual[n - 1 - i];
      if (a != null && b != null) {
        partidos.push({ fecha, team1Id: a, team2Id: b });
      }
    }
    // Rotación: la posición 0 queda fija, el último pasa al segundo
    // lugar, y el resto se corre un lugar. Es la forma estándar del
    // Circle Method — cada rotación genera una fecha con cruces
    // distintos a todas las anteriores, sin repetir ninguno.
    actual = [actual[0], actual[n - 1], ...actual.slice(1, n - 1)];
  }
  return partidos;
}

/* ── Equipo tardío: partidos contra cada compañero de grupo ya anotado,
   todos en una fecha nueva (la siguiente a la última jugada en ese
   grupo) — no toca ningún partido ya armado o jugado. */
export function armarFixtureTardio(teamId, companerosDeGrupoIds, fechaSiguiente) {
  return companerosDeGrupoIds.map((companeroId) => ({
    fecha: fechaSiguiente,
    team1Id: teamId,
    team2Id: companeroId,
  }));
}

/* ── Tabla de posiciones de un grupo ──────────────────────────────────────
   partidos: [{ team1Id, team2Id, winnerId, scoreA, scoreB }] — solo se
   cuentan los que ya tienen winnerId (los pendientes no suman nada).
   Orden: partidos ganados → diferencia de tantos → tantos a favor →
   resultado directo entre los empatados dentro del mismo grupo (head to
   head) — mismo criterio que usa FIFA para desempatar dentro de un grupo. */
export function rankearGrupo(equipoIds, partidos) {
  const stats = {};
  equipoIds.forEach((id) => {
    stats[id] = { id, pj: 0, pg: 0, pf: 0, pc: 0 };
  });
  partidos.forEach((p) => {
    if (!p.winnerId) return;
    const a = stats[p.team1Id];
    const b = stats[p.team2Id];
    if (a) {
      a.pj += 1;
      a.pf += p.scoreA;
      a.pc += p.scoreB;
      if (p.winnerId === p.team1Id) a.pg += 1;
    }
    if (b) {
      b.pj += 1;
      b.pf += p.scoreB;
      b.pc += p.scoreA;
      if (p.winnerId === p.team2Id) b.pg += 1;
    }
  });

  function resultadoDirecto(idA, idB) {
    // > 0 si A le ganó a B en su cruce directo, < 0 si perdió, 0 si no
    // jugaron o no hay winnerId todavía.
    let resultado = 0;
    partidos.forEach((p) => {
      if (!p.winnerId) return;
      const esDirecto =
        (p.team1Id === idA && p.team2Id === idB) || (p.team1Id === idB && p.team2Id === idA);
      if (!esDirecto) return;
      if (p.winnerId === idA) resultado += 1;
      else if (p.winnerId === idB) resultado -= 1;
    });
    return resultado;
  }

  const lista = Object.values(stats).map((e) => ({ ...e, dif: e.pf - e.pc }));
  lista.sort((a, b) => {
    if (b.pg !== a.pg) return b.pg - a.pg;
    if (b.dif !== a.dif) return b.dif - a.dif;
    if (b.pf !== a.pf) return b.pf - a.pf;
    return resultadoDirecto(b.id, a.id);
  });
  return lista.map((e, i) => ({ ...e, posicion: i + 1 }));
}

/* ── Ranking general (para elegir cupos de Copa de Oro/Plata) ────────────
   tablasPorGrupo: array de arrays, cada uno ya salido de rankearGrupo().
   Ordena primero por posición dentro del grupo (todos los 1° antes que
   todos los 2°, etc.) y dentro de la misma posición, por los mismos
   criterios de siempre — sin head-to-head, porque equipos de distintos
   grupos nunca jugaron entre sí (mismo criterio que usa FIFA para
   rankear a los mejores terceros). */
export function rankearGlobal(tablasPorGrupo) {
  const todos = tablasPorGrupo.flat();
  todos.sort((a, b) => {
    if (a.posicion !== b.posicion) return a.posicion - b.posicion;
    if (b.pg !== a.pg) return b.pg - a.pg;
    if (b.dif !== a.dif) return b.dif - a.dif;
    return b.pf - a.pf;
  });
  return todos;
}
