"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "../../../../lib/theme";
import { supabase } from "../../../../lib/supabaseClient";
import ThemeToggleButton from "../../../../components/ThemeToggleButton";
import { IconAtras } from "../../../../components/LineIcons";

function cantidadJugadores(categoria) {
  if (categoria === "1v1") return 1;
  if (categoria === "3v3") return 3;
  return 2;
}

function jugadorVacio() {
  return { name: "", dni: "", telefono: "", fecha_nacimiento: "", email: "" };
}

const RE_SIN_NUMEROS = /[0-9]/;
const RE_SOLO_NUMEROS = /^[0-9]+$/;
const RE_TELEFONO = /^[0-9 +-]+$/;
const RE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EDAD_MINIMA = 16;

function calcularEdad(fechaStr) {
  const nacimiento = new Date(fechaStr + "T00:00:00");
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad;
}

function validarJugador(j, esUnJugador) {
  const nombre = j.name.trim();
  if (nombre && RE_SIN_NUMEROS.test(nombre)) {
    return esUnJugador ? "Tu nombre no puede tener números." : "El nombre de un jugador no puede tener números.";
  }
  if (!j.fecha_nacimiento) {
    return esUnJugador ? "Falta tu fecha de nacimiento." : "Falta la fecha de nacimiento de un jugador.";
  }
  if (j.fecha_nacimiento > new Date().toISOString().slice(0, 10)) {
    return "La fecha de nacimiento no puede ser futura.";
  }
  if (calcularEdad(j.fecha_nacimiento) < EDAD_MINIMA) {
    return `Hay que tener al menos ${EDAD_MINIMA} años para anotarse.`;
  }
  if (j.dni.trim() && !RE_SOLO_NUMEROS.test(j.dni.trim())) {
    return "El DNI solo puede tener números.";
  }
  if (j.telefono.trim() && !RE_TELEFONO.test(j.telefono.trim())) {
    return "El teléfono solo puede tener números.";
  }
  if (j.email.trim() && !RE_EMAIL.test(j.email.trim())) {
    return "El mail no es válido.";
  }
  return null;
}

// Ningún dato de contacto puede repetirse entre los jugadores del mismo
// equipo (el resto — que no coincida con otro jugador ya anotado con
// este organizador — lo valida el servidor).
function buscarRepetidoEnEquipo(jugadores) {
  const vistos = { dni: new Set(), telefono: new Set(), email: new Set() };
  const etiquetas = { dni: "DNI", telefono: "teléfono", email: "mail" };
  for (const j of jugadores) {
    for (const campo of ["dni", "telefono", "email"]) {
      const valor = j[campo].trim().toLowerCase();
      if (!valor) continue;
      if (vistos[campo].has(valor)) return `Dos jugadores del equipo no pueden tener el mismo ${etiquetas[campo]}.`;
      vistos[campo].add(valor);
    }
  }
  return null;
}

export default function AnotarmeClient({ params }) {
  const { id } = params;
  const { T } = useTheme();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nombreEquipo, setNombreEquipo] = useState("");
  const [jugadores, setJugadores] = useState([jugadorVacio()]);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [sitioWeb, setSitioWeb] = useState(""); // campo trampa contra bots — invisible para una persona real

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("tournaments")
        .select("id, nombre, ubicacion, fecha, categoria, started, es_prueba")
        .eq("id", id)
        .single();
      setTournament(data);
      if (data) setJugadores(Array.from({ length: cantidadJugadores(data.categoria) }, jugadorVacio));
      setLoading(false);
    }
    load();
  }, [id]);

  function actualizarJugador(i, campo, valor) {
    setJugadores((prev) => prev.map((j, idx) => (idx === i ? { ...j, [campo]: valor } : j)));
  }

  async function enviar() {
    setError("");
    const nombre = nombreEquipo.trim();
    if (!nombre) {
      setError(tournament.categoria === "1v1" ? "Falta tu nombre." : "Falta el nombre del equipo.");
      return;
    }
    if (esUnJugador && RE_SIN_NUMEROS.test(nombre)) {
      setError("Tu nombre no puede tener números.");
      return;
    }
    if (!jugadores.some((j) => j.name.trim())) {
      setError("Cargá al menos un jugador.");
      return;
    }
    for (const j of jugadores) {
      const err = validarJugador(j, esUnJugador);
      if (err) {
        setError(err);
        return;
      }
    }
    const repetido = buscarRepetidoEnEquipo(jugadores);
    if (repetido) {
      setError(repetido);
      return;
    }
    if (!aceptaTerminos || !aceptaPrivacidad) {
      setError("Tenés que aceptar los Términos y Condiciones y la Política de Privacidad para continuar.");
      return;
    }
    setEnviando(true);
    const { error: err } = await supabase.rpc("anotarse_equipo", {
      p_tournament_id: id,
      p_nombre_equipo: nombre,
      p_jugadores: jugadores.map((j) => ({ ...j, name: j.name.trim() })),
      p_honeypot: sitioWeb,
    });
    setEnviando(false);
    if (err) {
      setError(err.message || "No se pudo anotar el equipo. Probá de nuevo en un minuto.");
      console.error(err);
      return;
    }
    setEnviado(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.ink }}>
        Cargando…
      </div>
    );
  }
  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6" style={{ background: T.bg, color: T.ink }}>
        No encontramos este torneo.
      </div>
    );
  }

  const esUnJugador = tournament.categoria === "1v1";

  return (
    <div className="transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-5">
          <Link
            href={`/torneo/${id}`}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: T.panel, border: `1px solid ${T.line}` }}
          >
            <IconAtras color={T.ink} />
          </Link>
          <ThemeToggleButton />
        </div>

        <h1 className="text-2xl font-black text-center mb-1" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
          {tournament.nombre || "Torneo"}
        </h1>
        <p className="text-center text-sm mb-6" style={{ color: T.goldBright }}>
          {[tournament.ubicacion, tournament.fecha].filter(Boolean).join(" · ")}
        </p>

        {tournament.started ? (
          <p className="text-center text-sm" style={{ color: T.inkDim }}>
            Las inscripciones para este torneo ya cerraron — el sorteo ya se hizo.
          </p>
        ) : enviado ? (
          <div className="rounded-2xl p-5 border shadow-sm text-center" style={{ background: T.panel, borderColor: T.line }}>
            <p className="font-bold mb-1" style={{ color: T.ink }}>
              ¡Listo, tu equipo está en revisión!
            </p>
            <p className="text-sm" style={{ color: T.inkDim }}>
              El organizador todavía tiene que confirmar tu inscripción antes de que cuente para el sorteo.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl p-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
              <div className="flex flex-col gap-3">
                <input
                  value={nombreEquipo}
                  onChange={(e) => setNombreEquipo(e.target.value)}
                  placeholder="Nombre del equipo"
                  className="px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                />

                {jugadores.map((j, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: T.bg, border: `1px solid ${T.line}` }}>
                    <div className="text-xs font-bold mb-2" style={{ color: T.inkDim }}>
                      {esUnJugador ? "Tus datos" : `Jugador ${i + 1}`}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        value={j.name}
                        onChange={(e) => actualizarJugador(i, "name", e.target.value)}
                        placeholder="Nombre completo"
                        className="px-3 py-2 rounded-lg text-sm"
                        style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                      />
                      <input
                        value={j.dni}
                        onChange={(e) => actualizarJugador(i, "dni", e.target.value)}
                        placeholder="DNI"
                        className="px-3 py-2 rounded-lg text-sm"
                        style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                      />
                      <input
                        value={j.telefono}
                        onChange={(e) => actualizarJugador(i, "telefono", e.target.value)}
                        placeholder="Teléfono"
                        className="px-3 py-2 rounded-lg text-sm"
                        style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                      />
                      <div>
                        <label className="text-[11px]" style={{ color: T.inkDim }}>
                          Fecha de nacimiento *
                        </label>
                        <input
                          value={j.fecha_nacimiento}
                          onChange={(e) => actualizarJugador(i, "fecha_nacimiento", e.target.value)}
                          type="date"
                          lang="es-AR"
                          max={new Date().toISOString().slice(0, 10)}
                          required
                          className="w-full px-3 py-2 rounded-lg text-sm mt-1"
                          style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                        />
                      </div>
                      <input
                        value={j.email}
                        onChange={(e) => actualizarJugador(i, "email", e.target.value)}
                        placeholder="Correo electrónico"
                        type="email"
                        className="px-3 py-2 rounded-lg text-sm"
                        style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                      />
                    </div>
                  </div>
                ))}

                {/* Campo trampa: invisible para una persona real, un bot que autocompleta todo sí lo llena */}
                <input
                  type="text"
                  value={sitioWeb}
                  onChange={(e) => setSitioWeb(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                />

                <label className="flex items-start gap-2 text-xs" style={{ color: T.inkDim }}>
                  <input
                    type="checkbox"
                    checked={aceptaTerminos}
                    onChange={(e) => setAceptaTerminos(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    He leído y acepto los{" "}
                    <Link href="/terminos-y-condiciones" target="_blank" className="underline font-semibold" style={{ color: T.goldBright }}>
                      Términos y Condiciones
                    </Link>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-xs" style={{ color: T.inkDim }}>
                  <input
                    type="checkbox"
                    checked={aceptaPrivacidad}
                    onChange={(e) => setAceptaPrivacidad(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    He leído y acepto la{" "}
                    <Link href="/politica-de-privacidad" target="_blank" className="underline font-semibold" style={{ color: T.goldBright }}>
                      Política de Privacidad
                    </Link>
                  </span>
                </label>

                {error && (
                  <p className="text-sm text-center" style={{ color: T.goldBright }}>
                    {error}
                  </p>
                )}

                <button
                  onClick={enviar}
                  disabled={enviando}
                  className="py-2.5 rounded-xl font-black text-sm mt-1 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                  style={{
                    background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`,
                    color: T.ink,
                    boxShadow: `0 6px 16px ${T.gold}44`,
                  }}
                >
                  {enviando ? "Anotando…" : "Anotarme"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
