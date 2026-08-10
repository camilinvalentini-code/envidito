"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "../../lib/theme";
import { useAuth } from "../../lib/useAuth";
import { supabase } from "../../lib/supabaseClient";
import { PAISES, provinciasDe } from "../../lib/geo";
import ThemeToggleButton from "../../components/ThemeToggleButton";
import { IconAtras } from "../../components/LineIcons";

function hoy() {
  return new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function CrearTorneo() {
  const { T } = useTheme();
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [nombre, setNombre] = useState("");
  const [pais, setPais] = useState("AR");
  const [provincia, setProvincia] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [lugar, setLugar] = useState("");
  const [ciudadesSugeridas, setCiudadesSugeridas] = useState([]);
  const [fecha, setFecha] = useState(hoy());
  const [categoria, setCategoria] = useState("2v2");
  const [repechaje, setRepechaje] = useState(false);
  const [puntosMax, setPuntosMax] = useState(30);
  const [modo, setModo] = useState("directa");
  const [encargado, setEncargado] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [testCantidad, setTestCantidad] = useState(8);
  const [testCategoria, setTestCategoria] = useState("2v2");
  const [testRepechaje, setTestRepechaje] = useState(true);
  const [testModo, setTestModo] = useState("directa");
  const [testLoading, setTestLoading] = useState(false);

  const NOMBRES_PRUEBA = [
    "Queen", "The Beatles", "The Rolling Stones", "Metallica", "Nirvana",
    "Pink Floyd", "Led Zeppelin", "AC/DC", "Guns N' Roses", "Red Hot Chili Peppers",
    "Coldplay", "Imagine Dragons", "Linkin Park", "Green Day", "Foo Fighters",
    "Rammstein", "Bon Jovi", "Radiohead", "Arctic Monkeys", "Twenty One Pilots",
    "Soda Stereo", "Los Redonditos de Ricota", "Divididos", "La Renga", "Babasónicos",
    "Bersuit Vergarabat", "Los Piojos", "Airbag", "No Te Va Gustar", "Cuarteto de Nos",
    "Tan Biónica", "Miranda!",
  ];

  useEffect(() => {
    async function cargarCiudades() {
      if (!provincia) {
        setCiudadesSugeridas([]);
        return;
      }
      const { data } = await supabase
        .from("tournaments")
        .select("ciudad")
        .eq("pais", pais)
        .eq("provincia", provincia)
        .not("ciudad", "is", null);
      const unicas = [...new Set((data || []).map((r) => r.ciudad).filter(Boolean))];
      setCiudadesSugeridas(unicas);
    }
    cargarCiudades();
  }, [pais, provincia]);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push("/organizador/acceso");
      return;
    }
    if (profile && profile.status !== "aprobado") {
      router.push("/organizador/pendiente");
    }
  }, [authLoading, session, profile, router]);

  async function crear() {
    setError("");
    if (!nombre.trim() || !provincia || !ciudad.trim() || !lugar.trim()) {
      setError("Faltan datos: nombre, provincia, ciudad y lugar son obligatorios.");
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("tournaments")
      .insert({
        nombre,
        pais,
        provincia,
        ciudad: ciudad.trim(),
        lugar: lugar.trim(),
        ubicacion: `${lugar.trim()}, ${ciudad.trim()}`, // por compatibilidad con vistas viejas
        fecha,
        categoria,
        repechaje,
        puntos_max: puntosMax,
        modo,
        encargado: encargado.trim() || null,
        organizador_id: session.user.id,
      })
      .select()
      .single();
    setLoading(false);
    if (err) {
      setError("No se pudo crear el torneo. Puede que tu cuenta todavía no esté aprobada.");
      console.error(err);
      return;
    }
    router.push(`/torneo/${data.id}/admin`);
  }

  async function generarTorneoPrueba() {
    setError("");
    setTestLoading(true);
    const n = Math.max(3, Math.min(64, Number(testCantidad) || 8));
    const nombreTest = `TEST ${n} equipos · ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
    const { data: torneo, error: err } = await supabase
      .from("tournaments")
      .insert({
        nombre: nombreTest,
        pais: "AR",
        provincia: "Córdoba",
        ciudad: "Córdoba",
        lugar: "Prueba",
        ubicacion: "Prueba, Córdoba",
        fecha: hoy(),
        categoria: testCategoria,
        es_prueba: true,
        repechaje: testRepechaje,
        modo: testModo,
        organizador_id: session.user.id,
      })
      .select()
      .single();
    if (err) {
      setError("No se pudo generar el torneo de prueba.");
      console.error(err);
      setTestLoading(false);
      return;
    }
    const equipos = Array.from({ length: n }, (_, i) => ({
      tournament_id: torneo.id,
      name: NOMBRES_PRUEBA[i % NOMBRES_PRUEBA.length] + (i >= NOMBRES_PRUEBA.length ? ` ${Math.floor(i / NOMBRES_PRUEBA.length) + 1}` : ""),
      players: "",
      paid: Math.random() < 0.6,
    }));
    await supabase.from("teams").insert(equipos);
    setTestLoading(false);
    router.push(`/torneo/${torneo.id}/admin`);
  }

  if (authLoading || !session || (profile && profile.status !== "aprobado")) return null;

  return (
    <div className="transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-md lg:max-w-2xl mx-auto px-4 lg:px-6 py-6">
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
        <h1 className="text-2xl font-black text-center mb-5" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
          Crear torneo
        </h1>

        <div className="rounded-2xl p-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
          <div className="flex flex-col gap-2.5">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del torneo*"
              className="px-3 py-2.5 rounded-xl text-sm"
              style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
            />

            <div className="flex gap-2">
              <select
                value={pais}
                onChange={(e) => {
                  setPais(e.target.value);
                  setProvincia("");
                  setCiudad("");
                }}
                className="px-3 py-2.5 rounded-xl text-sm flex-1"
                style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
              >
                {PAISES.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <select
                value={provincia}
                onChange={(e) => {
                  setProvincia(e.target.value);
                  setCiudad("");
                }}
                className="px-3 py-2.5 rounded-xl text-sm flex-1"
                style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
              >
                <option value="">{pais === "UY" ? "Departamento*" : "Provincia*"}</option>
                {provinciasDe(pais).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              <input
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="Ciudad*"
                list="ciudades-sugeridas"
                className="px-3 py-2.5 rounded-xl text-sm"
                style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
              />
              <datalist id="ciudades-sugeridas">
                {ciudadesSugeridas.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>

              <input
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                placeholder="Lugar*"
                className="px-3 py-2.5 rounded-xl text-sm"
                style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              <input
                value={encargado}
                onChange={(e) => setEncargado(e.target.value)}
                placeholder="¿Quién organiza? (opcional)"
                className="px-3 py-2.5 rounded-xl text-sm"
                style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
              />

              <input
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                placeholder="Fecha"
                className="px-3 py-2.5 rounded-xl text-sm"
                style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
              />
            </div>

            <div className="mt-1">
              <span className="text-xs font-bold" style={{ color: T.inkDim }}>
                Categoría
              </span>
              <div className="flex rounded-xl overflow-hidden border mt-1.5" style={{ borderColor: T.gold }}>
                {["1v1", "2v2", "3v3"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoria(c)}
                    className="flex-1 py-2 text-sm font-bold uppercase"
                    style={{ background: categoria === c ? T.gold : "transparent", color: categoria === c ? T.ink : T.inkDim }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-1">
              <span className="text-xs font-bold" style={{ color: T.inkDim }}>
                Formato
              </span>
              <div className="flex rounded-xl overflow-hidden border mt-1.5" style={{ borderColor: T.gold }}>
                <button
                  onClick={() => setModo("directa")}
                  className="flex-1 py-2 text-xs font-bold"
                  style={{ background: modo === "directa" ? T.gold : "transparent", color: modo === "directa" ? T.ink : T.inkDim }}
                >
                  Eliminación directa
                </button>
                <button
                  onClick={() => setModo("vidon")}
                  className="flex-1 py-2 text-xs font-bold"
                  style={{ background: modo === "vidon" ? T.gold : "transparent", color: modo === "vidon" ? T.ink : T.inkDim }}
                >
                  Sistema Vidón Bar
                </button>
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: T.inkDim }}>
                {modo === "vidon"
                  ? "Los que pierden en la primera ronda van rellenando los lugares vacíos del cuadro hasta completarlo, sin llave de repechaje aparte."
                  : "Los que pierden en la primera ronda arman su propia llave de repechaje, aparte del cuadro principal."}
              </p>
            </div>

            {modo === "directa" && (
              <label className="flex items-center gap-2 text-sm mt-1" style={{ color: T.ink }}>
                <input type="checkbox" checked={repechaje} onChange={(e) => setRepechaje(e.target.checked)} />
                Con repechaje
              </label>
            )}

            <div className="mt-1">
              <span className="text-xs font-bold" style={{ color: T.inkDim }}>
                Tanteador a
              </span>
              <div className="grid grid-cols-3 rounded-xl overflow-hidden border mt-1.5" style={{ borderColor: T.gold }}>
                {[15, 18, 20, 24, 30, 40].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPuntosMax(p)}
                    className="py-2 text-sm font-bold"
                    style={{ background: puntosMax === p ? T.gold : "transparent", color: puntosMax === p ? T.ink : T.inkDim }}
                  >
                    {p} puntos
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-center mt-3" style={{ color: T.goldBright }}>
            {error}
          </p>
        )}

        <button
          onClick={crear}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl font-black text-lg mt-4 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          style={{
            background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`,
            color: T.ink,
            boxShadow: `0 6px 16px ${T.gold}44`,
          }}
        >
          {loading ? "Creando…" : "Crear y anotar equipos →"}
        </button>

        <details className="rounded-2xl border mt-6 overflow-hidden" style={{ background: T.panel, borderColor: T.line }}>
          <summary className="px-4 py-3.5 text-xs font-bold cursor-pointer select-none" style={{ color: T.inkDim }}>
            Modo prueba (interno, para testear)
          </summary>
          <div className="px-4 pb-4">
            <p className="text-xs mb-3" style={{ color: T.inkDim }}>
              Crea un torneo con equipos falsos ya cargados, para testear rápido. No sirve para un torneo real —
              queda marcado como prueba y no aparece en las vistas públicas.
            </p>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs flex-shrink-0" style={{ color: T.inkDim }}>
                  Cantidad de equipos
                </span>
                <input
                  type="number"
                  min={3}
                  max={64}
                  value={testCantidad}
                  onChange={(e) => setTestCantidad(e.target.value)}
                  className="px-3 py-2 rounded-xl text-sm flex-1"
                  style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                />
              </div>
              <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: T.redDim }}>
                {["1v1", "2v2", "3v3"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setTestCategoria(c)}
                    className="flex-1 py-2 text-sm font-bold uppercase"
                    style={{ background: testCategoria === c ? T.redDim : "transparent", color: testCategoria === c ? "#FFFFFF" : T.inkDim }}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: T.ink }}>
                <input type="checkbox" checked={testRepechaje} onChange={(e) => setTestRepechaje(e.target.checked)} />
                Con repechaje
              </label>
              <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: T.redDim }}>
                {[
                  ["directa", "Directa"],
                  ["vidon", "Vidón Bar"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setTestModo(v)}
                    className="flex-1 py-2 text-xs font-bold"
                    style={{ background: testModo === v ? T.redDim : "transparent", color: testModo === v ? "#FFFFFF" : T.inkDim }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={generarTorneoPrueba}
                disabled={testLoading}
                className="py-2.5 rounded-xl font-bold text-sm mt-1 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60"
                style={{ background: T.redDim, color: "#FFFFFF" }}
              >
                {testLoading ? "Generando…" : "Generar y anotar equipos ya"}
              </button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
