"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "../../../../../../lib/theme";
import { useAuth } from "../../../../../../lib/useAuth";
import { supabase } from "../../../../../../lib/supabaseClient";
import ThemeToggleButton from "../../../../../../components/ThemeToggleButton";
import { IconAtras } from "../../../../../../components/LineIcons";
import Scoreboard from "../../../../../../components/Scoreboard";

const MAX_PUNTOS = 30;

export default function AnotadorLiga() {
  const { T } = useTheme();
  const router = useRouter();
  const params = useParams();
  const ligaId = params.id;
  const partidoId = params.partidoId;
  const { session, profile, loading: authLoading } = useAuth();

  const [liga, setLiga] = useState(null);
  const [partido, setPartido] = useState(null);
  const [equipoLocal, setEquipoLocal] = useState(null);
  const [equipoVisitante, setEquipoVisitante] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: l } = await supabase.from("ligas").select("*").eq("id", ligaId).single();
    const { data: p } = await supabase.from("liga_partidos").select("*").eq("id", partidoId).single();
    setLiga(l || null);
    setPartido(p || null);
    if (p) {
      const { data: eqs } = await supabase
        .from("liga_equipos")
        .select("id, nombre")
        .in("id", [p.equipo_local_id, p.equipo_visitante_id]);
      setEquipoLocal((eqs || []).find((e) => e.id === p.equipo_local_id) || null);
      setEquipoVisitante((eqs || []).find((e) => e.id === p.equipo_visitante_id) || null);
    }
    setLoading(false);
  }, [ligaId, partidoId]);

  useEffect(() => {
    if (!authLoading && !session) router.push("/organizador/acceso");
    if (!authLoading && profile && (profile.role !== "admin" || profile.status !== "aprobado")) {
      router.push("/organizador/panel");
    }
  }, [authLoading, session, profile, router]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  async function onChange(lado, delta) {
    if (!partido) return;
    const actualLocal = partido.puntos_local || 0;
    const actualVisitante = partido.puntos_visitante || 0;
    const nuevoLocal = lado === "A" ? Math.max(0, Math.min(MAX_PUNTOS, actualLocal + delta)) : actualLocal;
    const nuevoVisitante = lado === "B" ? Math.max(0, Math.min(MAX_PUNTOS, actualVisitante + delta)) : actualVisitante;

    const jugado = nuevoLocal === MAX_PUNTOS || nuevoVisitante === MAX_PUNTOS;
    const ganador_id = nuevoLocal === MAX_PUNTOS ? partido.equipo_local_id : nuevoVisitante === MAX_PUNTOS ? partido.equipo_visitante_id : null;

    const actualizado = { ...partido, puntos_local: nuevoLocal, puntos_visitante: nuevoVisitante, jugado, ganador_id };
    setPartido(actualizado);
    await supabase
      .from("liga_partidos")
      .update({ puntos_local: nuevoLocal, puntos_visitante: nuevoVisitante, jugado, ganador_id })
      .eq("id", partidoId);
  }

  async function reiniciar() {
    if (!window.confirm("¿Reiniciar el marcador de este partido a 0-0?")) return;
    const actualizado = { ...partido, puntos_local: 0, puntos_visitante: 0, jugado: false, ganador_id: null };
    setPartido(actualizado);
    await supabase
      .from("liga_partidos")
      .update({ puntos_local: 0, puntos_visitante: 0, jugado: false, ganador_id: null })
      .eq("id", partidoId);
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.ink }}>
        Cargando…
      </div>
    );
  }
  if (!session || !profile || profile.role !== "admin") return null;
  if (!partido || !equipoLocal || !equipoVisitante) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center" style={{ background: T.bg, color: T.ink }}>
        No se encontró ese partido.
      </div>
    );
  }

  return (
    <div className="transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          <Link
            href={`/admin/ligas/${ligaId}`}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: T.panel, border: `1px solid ${T.line}` }}
          >
            <IconAtras color={T.ink} />
          </Link>
          <ThemeToggleButton />
        </div>

        <h1 className="text-2xl font-black text-center mb-1" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
          Anotador
        </h1>
        <p className="text-center text-xs mb-5" style={{ color: T.inkDim }}>
          {liga?.nombre} · Fecha {partido.fecha_numero}
        </p>

        <Scoreboard
          nameA={equipoLocal.nombre}
          nameB={equipoVisitante.nombre}
          scoreA={partido.puntos_local || 0}
          scoreB={partido.puntos_visitante || 0}
          maxScore={MAX_PUNTOS}
          onChange={onChange}
        />

        {partido.jugado && (
          <div
            className="rounded-3xl p-5 mt-5 text-center border-2 shadow-md"
            style={{ background: "#FBF3E3", borderColor: "#EAC27A" }}
          >
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#B85C55" }}>
              Ganó
            </div>
            <div className="text-2xl font-black mt-1" style={{ color: "#33453E" }}>
              {partido.ganador_id === equipoLocal.id ? equipoLocal.nombre : equipoVisitante.nombre}
            </div>
          </div>
        )}

        <button
          onClick={reiniciar}
          className="w-full mt-4 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
        >
          Reiniciar marcador
        </button>
      </div>
    </div>
  );
}
