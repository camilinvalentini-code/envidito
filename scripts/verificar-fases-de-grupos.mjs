// Test de estrés standalone del motor de sorteo de "Fase de grupos".
// Se corre a mano: node scripts/verificar-fases-de-grupos.mjs
// No toca la base de datos ni depende de ningún framework de test —
// es solo aritmética sobre arrays, así que un script plano alcanza.
//
// Qué comprueba armarFixtureGrupo(teamIds), para muchísimas combinaciones
// de cantidad de equipos y muchas corridas al azar por combinación:
//   1. Ningún cruce se repite (cada par de equipos juega exactamente una vez).
//   2. Nadie juega contra sí mismo.
//   3. Nadie juega dos veces en la misma fecha.
//   4. La cantidad de fechas es la mínima matemática (N-1 par, N impar).
//   5. La cantidad total de partidos es exactamente N*(N-1)/2.
//
// También comprueba repartirEnGrupos(teamIds, cantidadGrupos):
//   6. No se pierde ni se duplica ningún equipo.
//   7. El reparto queda lo más parejo posible (diferencia máxima de 1 entre grupos).

import { armarFixtureGrupo, repartirEnGrupos } from "../lib/fasesDeGrupos.mjs";

let fallas = 0;
let corridas = 0;

function fail(msg) {
  fallas++;
  console.error("❌ " + msg);
}

function idsFake(n) {
  return Array.from({ length: n }, (_, i) => `T${i}`);
}

function verificarFixture(n, intento) {
  const teamIds = idsFake(n);
  const partidos = armarFixtureGrupo(teamIds);
  corridas++;

  // 5. cantidad total de partidos
  const esperados = (n * (n - 1)) / 2;
  if (partidos.length !== esperados) {
    fail(`N=${n} intento=${intento}: cantidad de partidos ${partidos.length}, esperaba ${esperados}`);
  }

  // 2. nadie juega contra sí mismo
  partidos.forEach((p) => {
    if (p.team1Id === p.team2Id) {
      fail(`N=${n} intento=${intento}: equipo ${p.team1Id} juega contra sí mismo`);
    }
  });

  // 1. ningún cruce se repite
  const vistos = new Set();
  partidos.forEach((p) => {
    const clave = [p.team1Id, p.team2Id].sort().join("|");
    if (vistos.has(clave)) {
      fail(`N=${n} intento=${intento}: cruce repetido ${clave}`);
    }
    vistos.add(clave);
  });

  // Confirma que TODOS los pares posibles están cubiertos (no solo que no se repiten)
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const clave = [teamIds[i], teamIds[j]].sort().join("|");
      if (!vistos.has(clave)) {
        fail(`N=${n} intento=${intento}: falta el cruce ${clave}`);
      }
    }
  }

  // 3. nadie juega dos veces en la misma fecha
  const porFecha = {};
  partidos.forEach((p) => {
    porFecha[p.fecha] = porFecha[p.fecha] || new Set();
    [p.team1Id, p.team2Id].forEach((id) => {
      if (porFecha[p.fecha].has(id)) {
        fail(`N=${n} intento=${intento}: ${id} juega dos veces en la fecha ${p.fecha}`);
      }
      porFecha[p.fecha].add(id);
    });
  });

  // 4. cantidad mínima de fechas
  const fechas = new Set(partidos.map((p) => p.fecha)).size;
  const fechasEsperadas = n % 2 === 0 ? n - 1 : n;
  if (fechas !== fechasEsperadas) {
    fail(`N=${n} intento=${intento}: usó ${fechas} fechas, la mínima matemática es ${fechasEsperadas}`);
  }
}

function verificarReparto(n, cantidadGrupos, intento) {
  const teamIds = idsFake(n);
  const grupos = repartirEnGrupos(teamIds, cantidadGrupos);
  corridas++;

  if (grupos.length !== cantidadGrupos) {
    fail(`reparto N=${n} grupos=${cantidadGrupos} intento=${intento}: devolvió ${grupos.length} grupos`);
    return;
  }

  const todos = grupos.flat();
  if (todos.length !== n) {
    fail(`reparto N=${n} grupos=${cantidadGrupos} intento=${intento}: total de equipos repartidos ${todos.length}, esperaba ${n}`);
  }
  if (new Set(todos).size !== n) {
    fail(`reparto N=${n} grupos=${cantidadGrupos} intento=${intento}: hay equipos duplicados o perdidos`);
  }

  const tamanos = grupos.map((g) => g.length);
  const max = Math.max(...tamanos);
  const min = Math.min(...tamanos);
  if (max - min > 1) {
    fail(`reparto N=${n} grupos=${cantidadGrupos} intento=${intento}: reparto desparejo (${tamanos.join(",")})`);
  }
}

const ITERACIONES_POR_N = 25;

// Fixture: grupos de 2 a 30 equipos, pares e impares, muchas corridas al azar
for (let n = 2; n <= 30; n++) {
  for (let intento = 0; intento < ITERACIONES_POR_N; intento++) {
    verificarFixture(n, intento);
  }
}

// Reparto en grupos: combinaciones típicas de torneo (8 a 64 equipos, 2 a 8 grupos)
for (let n = 8; n <= 64; n += 4) {
  for (const cantidadGrupos of [2, 3, 4, 6, 8]) {
    if (cantidadGrupos > n) continue;
    for (let intento = 0; intento < 10; intento++) {
      verificarReparto(n, cantidadGrupos, intento);
    }
  }
}

console.log(`Corridas totales: ${corridas}`);
if (fallas === 0) {
  console.log("✅ Todo OK — 0 fallas en todas las combinaciones probadas.");
  process.exit(0);
} else {
  console.error(`❌ ${fallas} falla(s) encontradas.`);
  process.exit(1);
}
