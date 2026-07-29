"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "../../../lib/theme";
import { useAuth } from "../../../lib/useAuth";
import { supabase } from "../../../lib/supabaseClient";
import ThemeToggleButton from "../../../components/ThemeToggleButton";
import SuitIcon from "../../../components/SuitIcon";

export default function RecuperarClave() {
  const { T } = useTheme();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [claveNueva, setClaveNueva] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  async function guardar() {
    if (claveNueva.trim().length < 6) {
      setError("La contraseña tiene que tener al menos 6 caracteres.");
      return;
    }
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: claveNueva.trim() });
    setLoading(false);
    if (err) {
      setError("No se pudo guardar. Probá de nuevo, o pedí el link de recuperación otra vez.");
      return;
    }
    setListo(true);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.ink }}>
        Cargando…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: T.bg }}>
        <div className="text-center max-w-sm">
          <p className="text-sm mb-4" style={{ color: T.ink }}>
            Este link de recuperación no es válido o ya venció. Pedí uno nuevo desde el acceso de organizadores.
          </p>
          <Link
            href="/organizador/acceso"
            className="inline-block px-5 py-2.5 rounded-2xl font-bold text-sm"
            style={{ background: T.gold, color: T.ink }}
          >
            Volver a pedir el link
          </Link>
        </div>
      </div>
    );
  }

  if (listo) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: T.bg }}>
        <div className="text-center max-w-sm">
          <p className="text-sm mb-4" style={{ color: T.ink }}>
            ✅ Contraseña actualizada. Ya podés usarla junto con tu email para entrar.
          </p>
          <button
            onClick={() => router.push("/organizador/panel")}
            className="inline-block px-5 py-2.5 rounded-2xl font-bold text-sm"
            style={{ background: T.gold, color: T.ink }}
          >
            Ir a mi panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex justify-between mb-4">
          <Link href="/" className="text-xs underline" style={{ color: T.inkDim }}>
            ← Inicio
          </Link>
          <ThemeToggleButton />
        </div>
        <div className="flex justify-center mb-2">
          <SuitIcon suit="espada" size={22} />
        </div>
        <h1 className="text-2xl font-black text-center mb-1" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
          Nueva contraseña
        </h1>
        <p className="text-center text-sm mb-6" style={{ color: T.inkDim }}>
          Elegí una contraseña nueva para tu cuenta.
        </p>
        <div className="rounded-2xl p-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
          <div className="flex flex-col gap-2">
            <input
              value={claveNueva}
              onChange={(e) => setClaveNueva(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && guardar()}
              type="password"
              placeholder="Nueva contraseña (mín. 6 caracteres)"
              className="px-3 py-2 rounded-xl text-sm"
              style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
            />
            <button
              onClick={guardar}
              disabled={loading}
              className="py-2 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60"
              style={{ background: T.gold, color: T.ink }}
            >
              {loading ? "Guardando…" : "Guardar contraseña"}
            </button>
          </div>
        </div>
        {error && (
          <p className="text-sm text-center mt-3" style={{ color: T.goldBright }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
