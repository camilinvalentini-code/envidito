"use client";
import React from "react";
import Link from "next/link";
import { useTheme } from "../../../lib/theme";
import ThemeToggleButton from "../../../components/ThemeToggleButton";
import { IconAtras, IconAbajo } from "../../../components/LineIcons";

const SERIF = "Georgia, serif";

function MiniMatch({ T, a, b, ganador, espera }) {
  const fila = (nombre, esGanador) => (
    <div
      className="px-3 py-2 rounded-xl text-sm font-semibold truncate"
      style={{
        color: ganador && !esGanador ? T.inkDim : T.ink,
        textDecoration: ganador && !esGanador ? "line-through" : "none",
        opacity: ganador && !esGanador ? 0.55 : 1,
      }}
    >
      {nombre}
    </div>
  );
  return (
    <div className="rounded-2xl border p-2" style={{ background: T.panel, borderColor: T.line }}>
      {fila(a, ganador === "a")}
      <div className="h-px my-1" style={{ background: T.line }} />
      {espera ? (
        <div className="text-xs text-center py-1.5 font-semibold" style={{ color: T.goldBright }}>
          espera rival
        </div>
      ) : (
        fila(b, ganador === "b")
      )}
    </div>
  );
}

function Seccion({ T, bg, titulo, children }) {
  return (
    <section className="rounded-3xl p-5 sm:p-6 border" style={{ background: bg, borderColor: T.line }}>
      <h2 className="font-bold text-lg mb-4" style={{ color: T.ink, fontFamily: SERIF }}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Paso({ T, n, titulo, children, isLast, illustration }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center font-black text-lg border-2 flex-shrink-0"
          style={{ borderColor: T.gold, color: T.goldBright, background: T.panel }}
        >
          {n}
        </div>
        {!isLast && <div className="w-px flex-1 mt-1" style={{ background: T.line, minHeight: "1.75rem" }} />}
      </div>
      <div className={`flex-1 min-w-0 ${isLast ? "" : "pb-6"}`}>
        <div className="rounded-2xl border p-4 shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
          <h3 className="font-bold text-base mb-1.5" style={{ color: T.ink, fontFamily: SERIF }}>
            {titulo}
          </h3>
          <div className="text-sm leading-relaxed" style={{ color: T.inkDim }}>
            {children}
          </div>
          {illustration}
        </div>
      </div>
    </div>
  );
}

function Herramienta({ T, icono, titulo, children }) {
  return (
    <div
      className="rounded-2xl p-4 border shadow-sm flex flex-col gap-2 h-full"
      style={{ background: T.panelLight, borderColor: T.line }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
        style={{ background: T.panel, color: T.goldBright, border: `1px solid ${T.line}` }}
      >
        {icono}
      </div>
      <h4 className="font-bold text-sm" style={{ color: T.ink, fontFamily: SERIF }}>
        {titulo}
      </h4>
      <div className="text-xs leading-relaxed" style={{ color: T.inkDim }}>
        {children}
      </div>
    </div>
  );
}

function FaqItem({ T, pregunta, children }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: T.panel, borderColor: T.line }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 text-left px-4 py-3.5"
      >
        <span className="text-sm font-bold" style={{ color: T.ink, fontFamily: SERIF }}>
          {pregunta}
        </span>
        <span
          className="flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <IconAbajo color={T.goldBright} />
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-xs leading-relaxed" style={{ color: T.inkDim }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function GuiaClasificatoria() {
  const { T } = useTheme();

  return (
    <div className="min-h-screen transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <Link
            href="/"
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: T.panel, border: `1px solid ${T.line}` }}
          >
            <IconAtras color={T.ink} />
          </Link>
          <ThemeToggleButton />
        </div>

        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: T.goldBright }}>
          Guía para organizadores
        </p>
        <h1 className="text-3xl font-black mb-2" style={{ color: T.ink, fontFamily: SERIF }}>
          La clasificatoria en Vidón Bar
        </h1>
        <p className="text-sm mb-8" style={{ color: T.inkDim }}>
          Qué es, cuándo conviene usarla, y cómo se maneja de principio a fin.
        </p>

        <div className="flex flex-col gap-6">
          {/* Por qué existe */}
          <Seccion T={T} bg={T.panelLight} titulo="El problema que resuelve">
            <p className="text-sm leading-relaxed mb-4" style={{ color: T.inkDim }}>
              En Vidón Bar todos juegan su primer partido ya mismo — nadie pasa gratis de ronda. Eso funciona
              perfecto cuando la cantidad de equipos ya es 8, 16, 32... Pero con números como 20, 21 o 15, el cuadro
              no cierra solo: sobran o faltan casilleros, y el torneo se puede quedar trabado esperando reingresos
              que nunca llegan.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: T.inkDim }}>
              La clasificatoria resuelve eso: todos juegan una ronda única, y de los ganadores más los perdedores que
              elijas (a mano o por sorteo) sale un cuadro limpio y parejo — sin casilleros vacíos, sin nadie
              esperando para siempre.
            </p>
          </Seccion>

          {/* Cuándo aparece */}
          <Seccion T={T} bg={T.panel} titulo="Cuándo aparece">
            <p className="text-sm leading-relaxed" style={{ color: T.inkDim }}>
              Es opcional, nunca obligatoria. Al anotar equipos para un torneo Vidón Bar, si la cantidad no es
              potencia de 2 (16, 32, 64...), aparece una tercera pestaña{" "}
              <b style={{ color: T.ink }}>"Clasificatoria"</b> junto a "Sorteo normal" y "Fase de grupos". Si ya
              está anotada la lista completa, usala. Si todavía pueden entrar parejas durante la noche, seguí con el
              Vidón clásico de siempre — para eso está.
            </p>
          </Seccion>

          {/* Pasos */}
          <Seccion T={T} bg={T.panelLight} titulo="Paso a paso">
            <div className="flex flex-col">
              <Paso T={T} n={1} titulo='Elegí la pestaña "Clasificatoria" y generala'>
                Se arma sola: todos los equipos, emparejados al azar, todos contra todos una vez. Si sobra un equipo
                (cantidad impar), queda "esperando rival" en vez de pasar gratis.
                <div className="mt-3 grid grid-cols-2 gap-2 max-w-xs">
                  <MiniMatch T={T} a="Los Fierreros" b="Doble Nueve" />
                  <MiniMatch T={T} a="Falta Envido" espera />
                </div>
              </Paso>

              <Paso T={T} n={2} titulo="Se juega, mismo anotador de siempre">
                Cada cruce tiene su link de anotador, igual que cualquier partido. Podés avisar todos los cruces por
                WhatsApp con un toque, y copiarlos si preferís pegarlos vos.
              </Paso>

              <Paso T={T} n={3} titulo="Si llega una pareja tardía, se agrega sin resortear nada">
                Se anota como cualquier equipo nuevo (mismo cuadro "Anotar equipo" de siempre). Si hay un cruce
                esperando rival, se completa solo. Si no hay ninguno, le arma uno nuevo. El resto de los cruces
                —jugados o pendientes— queda intacto.
              </Paso>

              <Paso T={T} n={4} titulo="Cuando termina el último partido, cerrás la clasificatoria">
                Los ganadores ya clasifican directo. Si hace falta completar el cupo con perdedores, elegís a mano o
                tocás "Sortear al azar" — el botón para armar el cuadro se habilita recién cuando la cuenta cierra
                justo a una potencia de dos.
              </Paso>

              <Paso T={T} n={5} titulo="Se arma el cuadro final, limpio" isLast>
                De ahí en adelante es la pantalla de siempre: cuadro, forzar resultados, reabrir partidos — nada
                distinto de un torneo armado del modo tradicional.
              </Paso>
            </div>
          </Seccion>

          {/* Herramientas extra */}
          <Seccion T={T} bg={T.panel} titulo="Otras herramientas útiles">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Herramienta T={T} icono="↻" titulo="Resortear">
                Mientras nadie jugó nada todavía, rearma los cruces de cero con los mismos equipos — por si el primer
                sorteo no te convenció.
              </Herramienta>
              <Herramienta T={T} icono="←" titulo="Volver a sorteo normal">
                Deshace la clasificatoria (o la fase de grupos) y te deja elegir el formato de nuevo — solo mientras
                nadie jugó nada ahí.
              </Herramienta>
              <Herramienta T={T} icono="⏭" titulo="Saltar casillero (Vidón clásico)">
                Para cuando NO usás clasificatoria: si un casillero del cuadro se queda vacío para siempre porque ya
                no quedan perdedores para reingresar, este botón lo cierra y hace pasar directo lo que corresponda.
              </Herramienta>
              <Herramienta T={T} icono="☰" titulo="Equipos que no clasifican">
                No desaparecen — quedan en la lista de equipos del torneo, simplemente no entran al cuadro final.
                Podés seguir corrigiendo sus datos o borrarlos si hace falta.
              </Herramienta>
            </div>
          </Seccion>

          {/* FAQ */}
          <Seccion T={T} bg={T.panelLight} titulo="Preguntas rápidas">
            <div className="flex flex-col gap-3">
              <FaqItem T={T} pregunta="¿Y si con mis equipos no hace falta elegir ningún perdedor?">
                Pasa cuando los ganadores solos ya arman un cuadro parejo (por ejemplo, 15 equipos → 7 ganadores + 1
                que pasó solo = 8, ya redondo). La pantalla te avisa directo, sin listas para tocar — solo confirmás.
              </FaqItem>
              <FaqItem T={T} pregunta="¿Puedo sacar un equipo mientras la clasificatoria está en juego?">
                Sí, desde la lista de equipos de siempre — mientras no haya jugado todavía. Si estaba emparejado, su
                rival queda esperando (o se junta con otro que ya estuviera esperando).
              </FaqItem>
              <FaqItem T={T} pregunta="¿Los espectadores y jugadores ven la clasificatoria?">
                Sí — el link público del torneo muestra la lista completa, y cada equipo puede elegir "cuál es el
                mío" para ver directo su propio cruce y el link a su anotador, igual que en el cuadro normal.
              </FaqItem>
            </div>
          </Seccion>
        </div>

        <div className="text-center pt-8 pb-2 mt-2" style={{ borderTop: `1px solid ${T.line}` }}>
          <Link href="/organizador/panel" className="text-sm font-bold" style={{ color: T.goldBright }}>
            ← Volver a mi panel
          </Link>
        </div>
      </div>
    </div>
  );
}
