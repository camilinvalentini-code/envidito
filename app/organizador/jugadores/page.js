"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "../../../lib/theme";
import { useAuth } from "../../../lib/useAuth";
import { supabase } from "../../../lib/supabaseClient";
import ThemeToggleButton from "../../../components/ThemeToggleButton";
import { IconAtras, IconWhatsApp } from "../../../components/LineIcons";

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

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("players")
      .select("id, name, telefono, email, fecha_nacimiento")
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
                  {numero && (
                    <a
                      href={`https://wa.me/${numero}?text=${encodeURIComponent(mensajeCumple(j.name))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "#25D366" }}
                    >
                      <IconWhatsApp color="#1B3A2A" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
