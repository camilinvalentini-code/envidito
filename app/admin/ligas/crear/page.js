"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "../../../../lib/theme";
import { useAuth } from "../../../../lib/useAuth";
import { supabase } from "../../../../lib/supabaseClient";
import ThemeToggleButton from "../../../../components/ThemeToggleButton";
import { IconAtras } from "../../../../components/LineIcons";

export default function CrearLiga() {
  const { T } = useTheme();
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();

  const [nombre, setNombre] = useState("");
  const [provincia, setProvincia] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [lugar, setLugar] = useState("");
  const [estructura, setEstructura] = useState("apertura_clausura");
  const [categoria, setCategoria] = useState("1v1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !session) router.push("/organizador/acceso");
    if (!authLoading && profile && (profile.role !== "admin" || profile.status !== "aprobado")) {
      router.push("/organizador/panel");
    }
  }, [authLoading, session, profile, router]);

  async function crear() {
    if (!nombre.trim()) {
      setError("Ponele un nombre a la liga.");
      return;
    }
    setError("");
    setLoading(true);
    const { data, error: err } = await supabase.rpc("crear_liga", {
      p_nombre: nombre.trim(),
      p_provincia: provincia.trim() || null,
      p_ciudad: ciudad.trim() || null,
      p_lugar: lugar.trim() || null,
      p_categoria: categoria,
      p_estructura: estructura,
    });
    setLoading(false);
    if (err) {
      setError("No se pudo crear la liga. Probá de nuevo.");
      return;
    }
    router.push(`/admin/ligas/${data}`);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.ink }}>
        Cargando…
      </div>
    );
  }
  if (!session || !profile || profile.role !== "admin") return null;

  return (
    <div className="transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          <Link
            href="/admin/panel"
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: T.panel, border: `1px solid ${T.line}` }}
          >
            <IconAtras color={T.ink} />
          </Link>
          <ThemeToggleButton />
        </div>

        <h1 className="text-2xl font-black text-center mb-1" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
          Crear liga
        </h1>
        <p className="text-center text-xs mb-6" style={{ color: T.inkDim }}>
          Por ahora solo vos como admin la ves y la administrás.
        </p>

        <div className="rounded-2xl p-4 border shadow-sm flex flex-col gap-2.5" style={{ background: T.panel, borderColor: T.line }}>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la liga*"
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
          />
          <div className="flex gap-2">
            <input
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
              placeholder="Provincia"
              className="flex-1 px-3 py-2 rounded-xl text-sm"
              style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
            />
            <input
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              placeholder="Ciudad"
              className="flex-1 px-3 py-2 rounded-xl text-sm"
              style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
            />
          </div>
          <input
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            placeholder="Lugar / bar sede"
            className="px-3 py-2 rounded-xl text-sm"
            style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
          />

          <div className="text-xs font-bold mt-1" style={{ color: T.inkDim }}>
            Estructura de la liga
          </div>
          <label
            className="flex items-start gap-2.5 p-3 rounded-xl cursor-pointer"
            style={
              estructura === "apertura_clausura"
                ? { border: `1.5px solid ${T.gold}`, background: T.panelLight }
                : { border: `1px solid ${T.line}` }
            }
          >
            <input
              type="radio"
              name="estructura"
              checked={estructura === "apertura_clausura"}
              onChange={() => setEstructura("apertura_clausura")}
              className="mt-0.5"
            />
            <span>
              <div className="text-sm font-extrabold" style={{ color: T.ink }}>Apertura y Clausura</div>
              <div className="text-xs mt-0.5" style={{ color: T.inkDim }}>
                Dos etapas con su propio campeón cada una, más una tabla acumulada de toda la temporada.
              </div>
            </span>
          </label>
          <label
            className="flex items-start gap-2.5 p-3 rounded-xl cursor-pointer"
            style={
              estructura === "unica"
                ? { border: `1.5px solid ${T.gold}`, background: T.panelLight }
                : { border: `1px solid ${T.line}` }
            }
          >
            <input
              type="radio"
              name="estructura"
              checked={estructura === "unica"}
              onChange={() => setEstructura("unica")}
              className="mt-0.5"
            />
            <span>
              <div className="text-sm font-extrabold" style={{ color: T.ink }}>Una sola etapa</div>
              <div className="text-xs mt-0.5" style={{ color: T.inkDim }}>
                Un torneo de liga corrido, con un único campeón al final.
              </div>
            </span>
          </label>

          <div className="text-xs font-bold mt-1" style={{ color: T.inkDim }}>
            Categoría
          </div>
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: T.gold }}>
            {["1v1", "2v2", "3v3"].map((c) => (
              <button
                key={c}
                onClick={() => setCategoria(c)}
                className="flex-1 py-2 text-xs font-bold"
                style={{ background: categoria === c ? T.gold : "transparent", color: categoria === c ? T.ink : T.inkDim }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-center mt-3" style={{ color: T.redDim }}>
            {error}
          </p>
        )}

        <button
          onClick={crear}
          disabled={loading}
          className="w-full mt-4 py-3 rounded-2xl font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60"
          style={{ background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`, color: T.ink }}
        >
          {loading ? "Creando…" : "Crear liga →"}
        </button>
      </div>
    </div>
  );
}
