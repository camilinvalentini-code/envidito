"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "../../../lib/theme";
import { useAuth } from "../../../lib/useAuth";
import { supabase } from "../../../lib/supabaseClient";
import ThemeToggleButton from "../../../components/ThemeToggleButton";
import { IconAtras } from "../../../components/LineIcons";

export default function ListaLigas() {
  const { T } = useTheme();
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const [ligas, setLigas] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("ligas").select("*").order("created_at", { ascending: false });
    setLigas(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !session) router.push("/organizador/acceso");
    if (!authLoading && profile && (profile.role !== "admin" || profile.status !== "aprobado")) {
      router.push("/organizador/panel");
    }
  }, [authLoading, session, profile, router]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.ink }}>
        Cargando…
      </div>
    );
  }
  if (!session || !profile || profile.role !== "admin") return null;

  return (
    <div className="min-h-screen transition-colors duration-500" style={{ background: T.bg }}>
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
          Ligas
        </h1>
        <p className="text-center text-xs mb-6" style={{ color: T.inkDim }}>
          Sección interna, todavía no es pública.
        </p>

        <Link
          href="/admin/ligas/crear"
          className="block text-center py-2.5 rounded-2xl font-bold text-sm mb-6 transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`, color: T.ink }}
        >
          + Crear liga
        </Link>

        {ligas.length === 0 ? (
          <p className="text-center text-sm" style={{ color: T.inkDim }}>
            Todavía no creaste ninguna liga.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {ligas.map((l) => (
              <Link
                key={l.id}
                href={`/admin/ligas/${l.id}`}
                className="px-4 py-3 rounded-xl text-sm transition-colors duration-200"
                style={{ background: T.panel, border: `1px solid ${T.line}` }}
              >
                <div className="font-bold" style={{ color: T.ink }}>
                  {l.nombre}
                </div>
                <div className="text-xs mt-0.5" style={{ color: T.inkDim }}>
                  {[l.ciudad, l.categoria].filter(Boolean).join(" · ")}
                  {" · "}
                  {l.estructura === "apertura_clausura" ? "Apertura y Clausura" : "Etapa única"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
