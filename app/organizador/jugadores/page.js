"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "../../../lib/theme";
import { useAuth } from "../../../lib/useAuth";
import { supabase } from "../../../lib/supabaseClient";
import ThemeToggleButton from "../../../components/ThemeToggleButton";
import { IconAtras, IconWhatsApp, IconLapiz, IconBasura } from "../../../components/LineIcons";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function diasHastaProximoCumple(fechaStr) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const nacimiento = new Date(fechaStr + "T00:00:00");
  let proximo = new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
  if (proximo < hoy) proximo = new Date(hoy.getFullYear() + 1, nacimiento.getMonth(), nacimiento.getDate());
  return Math.round((proximo - hoy) / 86400000);
}

function edadQueCumple(fechaStr) {
  const hoy = new Date();
  const nacimiento = new Date(fechaStr + "T00:00:00");
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const yaPaso =
    hoy.getMonth() > nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate());
  return yaPaso ? edad + 1 : edad;
}

function formatearFecha(fechaStr) {
  const [, mes, dia] = fechaStr.split("-");
  return `${parseInt(dia, 10)} de ${MESES[parseInt(mes, 10) - 1]}`;
}

function mensajeCumple(nombre) {
  const primerNombre = nombre.trim().split(" ")[0];
  return `¡Feliz cumpleaños, ${primerNombre}! 🎉 Te mandamos un saludo grande, nos vemos en la próxima.`;
}

export default function JugadoresOrganizador() {
  const { T } = useTheme();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [jugadores, setJugadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState(null); // copia del jugador en edición, o null
  const [guardando, setGuardando] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("players")
      .select("id, name, dni, telefono, email, fecha_nacimiento")
      .not("fecha_nacimiento", "is", null);
    setJugadores(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !session) router.push("/organizador/acceso");
  }, [authLoading, session, router]);

  useEffect(() => {
    load();
  }, [load]);

  function abrirEdicion(j) {
    setEditando({ ...j });
  }

  function actualizarCampoEdicion(campo, valor) {
    setEditando((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  async function guardarEdicion() {
    if (!editando) return;
    setGuardando(true);
    await supabase
      .from("players")
      .update({
        name: editando.name?.trim() || null,
        dni: editando.dni?.trim() || null,
        telefono: editando.telefono?.trim() || null,
        fecha_nacimiento: editando.fecha_nacimiento || null,
        email: editando.email?.trim() || null,
      })
      .eq("id", editando.id);
    setGuardando(false);
    setEditando(null);
    load();
  }

  async function borrarJugador(j) {
    if (!window.confirm(`¿Borrar a "${j.name}" de tu lista de jugadores? No se puede deshacer.`)) return;
    await supabase.from("players").delete().eq("id", j.id);
    load();
  }

  if (authLoading || loading) return null;
  if (!session) return null;

  const ordenados = jugadores
    .filter((j) => j.name.toLowerCase().includes(busqueda.toLowerCase()))
    .map((j) => ({ ...j, dias: diasHastaProximoCumple(j.fecha_nacimiento) }))
    .sort((a, b) => a.dias - b.dias);

  return (
    <div className="min-h-screen transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-5">
          <Link
            href="/organizador/panel"
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: T.panel, border: `1px solid ${T.line}` }}
          >
            <IconAtras color={T.ink} />
          </Link>
          <ThemeToggleButton />
        </div>

        <h1 className="text-2xl font-black text-center mb-1" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
          🎂 Cumpleaños
        </h1>
        <p className="text-center text-sm mb-5" style={{ color: T.inkDim }}>
          Todos los jugadores que se anotaron alguna vez en tus torneos, ordenados por el próximo cumpleaños.
        </p>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar jugador..."
          className="w-full px-3 py-2 rounded-xl text-sm mb-4"
          style={{ background: T.panel, color: T.ink, border: `1px solid ${T.line}` }}
        />

        {ordenados.length === 0 ? (
          <p className="text-center text-sm py-8" style={{ color: T.inkDim }}>
            Todavía no hay jugadores con fecha de nacimiento cargada.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {ordenados.map((j) => {
              const numero = j.telefono ? j.telefono.replace(/\D/g, "") : null;
              const esHoy = j.dias === 0;
              return (
                <div
                  key={j.id}
                  className="rounded-2xl p-3 border shadow-sm flex items-center justify-between gap-2"
                  style={{
                    background: esHoy ? "#FBF3E3" : T.panel,
                    borderColor: esHoy ? "#EAC27A" : T.line,
                  }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: esHoy ? "#33453E" : T.ink }}>
                      {j.name}
                    </div>
                    <div className="text-xs" style={{ color: esHoy ? "#B85C55" : T.inkDim }}>
                      {esHoy
                        ? `🎉 ¡Hoy cumple ${edadQueCumple(j.fecha_nacimiento)}!`
                        : `${formatearFecha(j.fecha_nacimiento)} · cumple ${edadQueCumple(j.fecha_nacimiento)} en ${j.dias} día${
                            j.dias === 1 ? "" : "s"
                          }`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {numero && (
                      <a
                        href={`https://wa.me/${numero}?text=${encodeURIComponent(mensajeCumple(j.name))}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: "#25D366" }}
                      >
                        <IconWhatsApp color="#1B3A2A" />
                      </a>
                    )}
                    <button
                      onClick={() => abrirEdicion(j)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: esHoy ? "#FFFFFF" : T.panelLight, border: `1px solid ${esHoy ? "#EAC27A" : T.line}` }}
                    >
                      <IconLapiz color={esHoy ? "#33453E" : T.ink} />
                    </button>
                    <button
                      onClick={() => borrarJugador(j)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: esHoy ? "#FFFFFF" : T.panelLight, border: `1px solid ${esHoy ? "#EAC27A" : T.line}` }}
                    >
                      <IconBasura color={T.redDim} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editando && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setEditando(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-4 border shadow-lg"
            style={{ background: T.panel, borderColor: T.line }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-sm mb-3" style={{ color: T.gold }}>
              Editar jugador
            </h3>
            <div className="flex flex-col gap-2">
              <input
                value={editando.name || ""}
                onChange={(e) => actualizarCampoEdicion("name", e.target.value)}
                placeholder="Nombre completo"
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
              />
              <input
                value={editando.dni || ""}
                onChange={(e) => actualizarCampoEdicion("dni", e.target.value)}
                placeholder="DNI"
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
              />
              <input
                value={editando.telefono || ""}
                onChange={(e) => actualizarCampoEdicion("telefono", e.target.value)}
                placeholder="Teléfono"
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
              />
              <div>
                <label className="text-[11px]" style={{ color: T.inkDim }}>
                  Fecha de nacimiento
                </label>
                <input
                  value={editando.fecha_nacimiento || ""}
                  onChange={(e) => actualizarCampoEdicion("fecha_nacimiento", e.target.value)}
                  type="date"
                  lang="es-AR"
                  className="w-full px-3 py-2 rounded-lg text-sm mt-1"
                  style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                />
              </div>
              <input
                value={editando.email || ""}
                onChange={(e) => actualizarCampoEdicion("email", e.target.value)}
                placeholder="Correo electrónico"
                type="email"
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditando(null)}
                className="flex-1 py-2 rounded-xl font-bold text-sm"
                style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                disabled={guardando}
                className="flex-1 py-2 rounded-xl font-black text-sm disabled:opacity-50"
                style={{ background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`, color: T.ink }}
              >
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
