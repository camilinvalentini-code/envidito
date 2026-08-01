"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "../../../../../lib/theme";
import { useAuth } from "../../../../../lib/useAuth";
import { supabase } from "../../../../../lib/supabaseClient";
import ThemeToggleButton from "../../../../../components/ThemeToggleButton";
import { IconAtras } from "../../../../../components/LineIcons";

function TablaFilas({ T, filas }) {
  const ordenadas = [...filas].sort((a, b) => b.pg - a.pg || b.dif - a.dif);
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: T.panel, borderColor: T.line }}>
      <div
        className="grid gap-1 px-2.5 py-2 text-[10px] font-extrabold uppercase"
        style={{ gridTemplateColumns: "20px 1fr 24px 24px 24px 30px 24px 24px", background: T.panelLight, color: T.inkDim }}
      >
        <div>#</div>
        <div>Equipo</div>
        <div className="text-center">PJ</div>
        <div className="text-center">PG</div>
        <div className="text-center">PP</div>
        <div className="text-center">DIF</div>
        <div className="text-center">TA</div>
        <div className="text-center">TC</div>
      </div>
      {ordenadas.map((f, i) => (
        <div
          key={f.equipo_id}
          className="grid gap-1 px-2.5 py-2 items-center text-xs"
          style={{
            gridTemplateColumns: "20px 1fr 24px 24px 24px 30px 24px 24px",
            borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
            background: i === 0 ? T.panelLight : "transparent",
            borderLeft: i === 0 ? `3px solid ${T.goldBright}` : "none",
          }}
        >
          <div className="font-extrabold" style={{ color: i === 0 ? T.goldBright : T.ink }}>
            {i + 1}
          </div>
          <div className="font-bold truncate" style={{ color: T.ink }}>
            {f.equipo_nombre}
          </div>
          <div className="text-center" style={{ color: T.ink }}>
            {f.pj}
          </div>
          <div className="text-center" style={{ color: T.ink }}>
            {f.pg}
          </div>
          <div className="text-center" style={{ color: T.ink }}>
            {f.pp}
          </div>
          <div className="text-center" style={{ color: T.ink }}>
            {f.dif > 0 ? `+${f.dif}` : f.dif}
          </div>
          <div className="text-center" style={{ color: T.ink }}>
            {f.ta}
          </div>
          <div className="text-center" style={{ color: T.ink }}>
            {f.tc}
          </div>
        </div>
      ))}
      {ordenadas.length === 0 && (
        <div className="px-3 py-4 text-center text-xs" style={{ color: T.inkDim }}>
          Todavía no hay partidos jugados.
        </div>
      )}
    </div>
  );
}

export default function TablaLiga() {
  const { T } = useTheme();
  const router = useRouter();
  const params = useParams();
  const ligaId = params.id;
  const { session, profile, loading: authLoading } = useAuth();

  const [liga, setLiga] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [vista, setVista] = useState(null); // etapa id, o "acumulada"
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadBase = useCallback(async () => {
    const { data: l } = await supabase.from("ligas").select("*").eq("id", ligaId).single();
    const { data: et } = await supabase.from("liga_etapas").select("*").eq("liga_id", ligaId).order("orden");
    setLiga(l || null);
    setEtapas(et || []);
    setVista((prev) => prev || (et && et[0] ? et[0].id : "acumulada"));
    setLoading(false);
  }, [ligaId]);

  const loadFilas = useCallback(async () => {
    if (!vista) return;
    if (vista === "acumulada") {
      const { data } = await supabase.from("liga_tabla_acumulada").select("*").eq("liga_id", ligaId);
      setFilas(data || []);
    } else {
      const { data } = await supabase.from("liga_tabla_posiciones").select("*").eq("etapa_id", vista);
      setFilas(data || []);
    }
  }, [ligaId, vista]);

  useEffect(() => {
    if (!authLoading && !session) router.push("/organizador/acceso");
    if (!authLoading && profile && (profile.role !== "admin" || profile.status !== "aprobado")) {
      router.push("/organizador/panel");
    }
  }, [authLoading, session, profile, router]);

  useEffect(() => {
    if (session) loadBase();
  }, [session, loadBase]);

  useEffect(() => {
    loadFilas();
  }, [loadFilas]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.ink }}>
        Cargando…
      </div>
    );
  }
  if (!session || !profile || profile.role !== "admin") return null;
  if (!liga) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center" style={{ background: T.bg, color: T.ink }}>
        No se encontró esa liga.
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-3">
          <Link
            href={`/admin/ligas/${ligaId}`}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: T.panel, border: `1px solid ${T.line}` }}
          >
            <IconAtras color={T.ink} />
          </Link>
          <ThemeToggleButton />
        </div>

        <h1 className="text-xl font-black text-center" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
          {liga.nombre}
        </h1>
        <p className="text-center text-xs mb-4" style={{ color: T.inkDim }}>
          Tabla de posiciones
        </p>

        {etapas.length > 0 && (
          <div className="flex rounded-xl overflow-hidden p-0.5 mb-4 gap-0.5" style={{ background: T.panelLight }}>
            {etapas.map((e) => (
              <button
                key={e.id}
                onClick={() => setVista(e.id)}
                className="flex-1 py-1.5 text-xs font-bold rounded-lg"
                style={{ background: vista === e.id ? T.gold : "transparent", color: vista === e.id ? T.ink : T.inkDim }}
              >
                {e.nombre}
              </button>
            ))}
            {etapas.length > 1 && (
              <button
                onClick={() => setVista("acumulada")}
                className="flex-1 py-1.5 text-xs font-bold rounded-lg"
                style={{ background: vista === "acumulada" ? T.gold : "transparent", color: vista === "acumulada" ? T.ink : T.inkDim }}
              >
                Acumulada
              </button>
            )}
          </div>
        )}

        <TablaFilas T={T} filas={filas} />

        <p className="text-center text-[10.5px] leading-relaxed mt-3" style={{ color: T.inkDim }}>
          PJ jugados · PG ganados · PP perdidos · DIF diferencia de tantos · TA tantos a favor · TC tantos en contra.
          <br />
          Se actualiza sola apenas se carga un resultado.
        </p>
      </div>
    </div>
  );
}
