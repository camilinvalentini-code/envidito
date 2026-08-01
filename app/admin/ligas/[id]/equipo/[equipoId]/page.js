"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "../../../../../../lib/theme";
import { useAuth } from "../../../../../../lib/useAuth";
import { supabase } from "../../../../../../lib/supabaseClient";
import ThemeToggleButton from "../../../../../../components/ThemeToggleButton";
import { IconAtras } from "../../../../../../components/LineIcons";

export default function FichaEquipo() {
  const { T } = useTheme();
  const router = useRouter();
  const params = useParams();
  const ligaId = params.id;
  const equipoId = params.equipoId;
  const { session, profile, loading: authLoading } = useAuth();

  const [liga, setLiga] = useState(null);
  const [equipo, setEquipo] = useState(null);
  const [equiposById, setEquiposById] = useState({});
  const [etapasById, setEtapasById] = useState({});
  const [partidos, setPartidos] = useState([]);
  const [fila, setFila] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: l } = await supabase.from("ligas").select("*").eq("id", ligaId).single();
    const { data: eq } = await supabase.from("liga_equipos").select("*, liga_integrantes(*)").eq("id", equipoId).single();
    const { data: todosEquipos } = await supabase.from("liga_equipos").select("id, nombre").eq("liga_id", ligaId);
    const { data: todasEtapas } = await supabase.from("liga_etapas").select("id, nombre").eq("liga_id", ligaId);
    const { data: p } = await supabase
      .from("liga_partidos")
      .select("*")
      .or(`equipo_local_id.eq.${equipoId},equipo_visitante_id.eq.${equipoId}`)
      .order("fecha_numero");
    const mapaEquipos = {};
    (todosEquipos || []).forEach((e) => (mapaEquipos[e.id] = e));
    const mapaEtapas = {};
    (todasEtapas || []).forEach((e) => (mapaEtapas[e.id] = e));
    setLiga(l || null);
    setEquipo(eq || null);
    setEquiposById(mapaEquipos);
    setEtapasById(mapaEtapas);
    setPartidos(p || []);
    setLoading(false);
  }, [ligaId, equipoId]);

  useEffect(() => {
    if (!authLoading && !session) router.push("/organizador/acceso");
    if (!authLoading && profile && (profile.role !== "admin" || profile.status !== "aprobado")) {
      router.push("/organizador/panel");
    }
  }, [authLoading, session, profile, router]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  useEffect(() => {
    async function loadFila() {
      if (!partidos.length) return;
      const etapaId = partidos[0]?.etapa_id;
      if (!etapaId) return;
      const { data } = await supabase
        .from("liga_tabla_posiciones")
        .select("*")
        .eq("etapa_id", etapaId)
        .eq("equipo_id", equipoId)
        .maybeSingle();
      setFila(data || null);
    }
    loadFila();
  }, [partidos, equipoId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.ink }}>
        Cargando…
      </div>
    );
  }
  if (!session || !profile || profile.role !== "admin") return null;
  if (!equipo) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center" style={{ background: T.bg, color: T.ink }}>
        No se encontró ese equipo.
      </div>
    );
  }

  const proximo = partidos.find((p) => !p.jugado);
  const jugados = partidos.filter((p) => p.jugado).reverse();

  return (
    <div className="min-h-screen transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-md mx-auto px-4 py-6">
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

        <div className="text-center mb-1">
          <div className="text-2xl font-black" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
            {equipo.nombre}
          </div>
          <div className="text-xs mt-0.5" style={{ color: T.inkDim }}>
            {liga?.nombre}
          </div>
        </div>
        <div className="flex justify-center gap-2 mb-4">
          {fila && (
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: T.panelLight, color: T.goldBright }}>
              {fila.pj} PJ · {fila.pg} PG
            </span>
          )}
          <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: T.panelLight, color: T.inkDim }}>
            código {equipo.codigo}
          </span>
        </div>

        {equipo.liga_integrantes?.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mb-5">
            {equipo.liga_integrantes.map((it) => (
              <span key={it.id} className="text-xs px-2.5 py-1 rounded-full" style={{ background: T.panelLight, color: T.ink }}>
                {it.nombre}
              </span>
            ))}
          </div>
        )}

        {proximo && (
          <div className="rounded-2xl p-3.5 mb-5" style={{ background: T.panel, border: `1px solid ${T.gold}` }}>
            <div className="text-[10.5px] font-extrabold uppercase tracking-wide mb-2" style={{ color: T.goldBright }}>
              Próximo partido
            </div>
            <div className="flex items-center justify-between text-sm font-extrabold" style={{ color: T.ink }}>
              <span>{equiposById[proximo.equipo_local_id]?.nombre}</span>
              <span className="text-xs font-bold" style={{ color: T.inkDim }}>
                vs
              </span>
              <span>{equiposById[proximo.equipo_visitante_id]?.nombre}</span>
            </div>
            <div className="text-xs text-center mt-1.5" style={{ color: T.inkDim }}>
              {etapasById[proximo.etapa_id]?.nombre} · Fecha {proximo.fecha_numero}
            </div>
          </div>
        )}

        <div className="text-xs font-extrabold uppercase tracking-wide mb-2" style={{ color: T.inkDim }}>
          Resultados anteriores
        </div>
        <div className="flex flex-col gap-2 mb-5">
          {jugados.length === 0 && (
            <p className="text-sm" style={{ color: T.inkDim }}>
              Todavía no jugó ningún partido.
            </p>
          )}
          {jugados.map((p) => {
            const esLocal = p.equipo_local_id === equipoId;
            const propio = equiposById[esLocal ? p.equipo_local_id : p.equipo_visitante_id]?.nombre;
            const rival = equiposById[esLocal ? p.equipo_visitante_id : p.equipo_local_id]?.nombre;
            const puntosPropios = esLocal ? p.puntos_local : p.puntos_visitante;
            const puntosRival = esLocal ? p.puntos_visitante : p.puntos_local;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background: T.panel, border: `1px solid ${T.line}` }}
              >
                <span className="text-sm font-bold" style={{ color: T.ink }}>
                  {propio} <span style={{ color: T.goldBright }}>{puntosPropios}</span>
                </span>
                <span className="text-xs" style={{ color: T.inkDim }}>
                  vs
                </span>
                <span className="text-sm" style={{ color: T.inkDim }}>
                  {rival} {puntosRival}
                </span>
              </div>
            );
          })}
        </div>

        <Link
          href={`/admin/ligas/${ligaId}/tabla`}
          className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ background: T.panel, border: `1px solid ${T.line}` }}
        >
          <span className="text-sm font-bold" style={{ color: T.ink }}>
            Ver tabla completa
          </span>
          <span style={{ color: T.inkDim }}>→</span>
        </Link>
      </div>
    </div>
  );
}
