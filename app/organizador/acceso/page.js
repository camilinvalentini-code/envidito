"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "../../../lib/theme";
import { supabase } from "../../../lib/supabaseClient";
import ThemeToggleButton from "../../../components/ThemeToggleButton";

export default function AccesoOrganizador() {
  const { T } = useTheme();
  const router = useRouter();
  const [modo, setModo] = useState("link"); // "link" | "clave"
  const [enviado, setEnviado] = useState(false);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [recuperoMsg, setRecuperoMsg] = useState("");

  const TERMS_VERSION = "1.0";
  const PRIVACY_VERSION = "1.0";

  async function recuperarClave() {
    if (!email.trim()) {
      setError("Ingresá tu email arriba, así te mandamos el link para poner una contraseña nueva.");
      return;
    }
    setError("");
    setRecuperando(true);
    setRecuperoMsg("");
    const redirectTo = `${window.location.origin}/organizador/recuperar`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setRecuperando(false);
    if (err) {
      setError("No se pudo enviar el mail de recuperación. Probá de nuevo en un minuto.");
      return;
    }
    setRecuperoMsg(`Te mandamos un mail a ${email.trim()} para poner una contraseña nueva. Revisá spam si no te llega.`);
  }

  async function enviarLink() {
    if (!email.trim()) {
      setError("Ingresá tu email.");
      return;
    }
    if (!aceptaTerminos || !aceptaPrivacidad) {
      setError("Tenés que aceptar los Términos y Condiciones y la Política de Privacidad para continuar.");
      return;
    }
    setError("");
    setLoading(true);
    const redirectTo = `${window.location.origin}/organizador/panel`;
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        data: {
          nombre: nombre.trim(),
          acceptedTerms: true,
          acceptedPrivacy: true,
          acceptedAt: new Date().toISOString(),
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
        },
        emailRedirectTo: redirectTo,
      },
    });
    setLoading(false);
    if (err) {
      setError("No se pudo enviar el link. Probá de nuevo en un minuto.");
      return;
    }
    setEnviado(true);
  }

  async function entrarConClave() {
    if (!email.trim() || !clave.trim()) {
      setError("Ingresá tu email y tu contraseña.");
      return;
    }
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: clave,
    });
    setLoading(false);
    if (err) {
      setError("Email o contraseña incorrectos. Si todavía no configuraste una contraseña, entrá con el link y configurala desde tu panel.");
      return;
    }
    router.push("/organizador/panel");
  }

  return (
    <div className="transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex justify-between mb-5">
          <Link
            href="/"
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: T.panel, border: `1px solid ${T.line}` }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke={T.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <ThemeToggleButton />
        </div>
        <h1 className="text-2xl font-black text-center mb-4" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
          Acceso organizadores
        </h1>

        <div className="flex rounded-xl p-0.5 gap-0.5 mb-4" style={{ background: T.panelLight }}>
          <button
            onClick={() => { setModo("link"); setError(""); }}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors duration-200"
            style={{ background: modo === "link" ? T.gold : "transparent", color: modo === "link" ? T.ink : T.inkDim }}
          >
            Con link (mail)
          </button>
          <button
            onClick={() => { setModo("clave"); setError(""); }}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors duration-200"
            style={{ background: modo === "clave" ? T.gold : "transparent", color: modo === "clave" ? T.ink : T.inkDim }}
          >
            Con contraseña
          </button>
        </div>

        {modo === "link" ? (
          <>
            <p className="text-center text-sm mb-6" style={{ color: T.inkDim }}>
              {enviado
                ? `Te mandamos un mail a ${email}. Abrilo y tocá el link — con eso quedás adentro. Puede tardar un minuto, revisá spam.`
                : "Ingresá tu email — te mandamos un link para entrar, sin contraseña."}
            </p>
            {!enviado && (
              <div className="rounded-2xl p-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
                <div className="flex flex-col gap-2.5">
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Nombre del bar / organizador"
                    className="px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                  />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    type="email"
                    className="px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
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
                  <button
                    onClick={enviarLink}
                    disabled={loading || !aceptaTerminos || !aceptaPrivacidad}
                    className="py-2.5 rounded-xl font-black text-sm mt-1 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                    style={{
                      background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`,
                      color: T.ink,
                      boxShadow: `0 6px 16px ${T.gold}44`,
                    }}
                  >
                    {loading ? "Enviando…" : "Enviarme el link"}
                  </button>
                </div>
              </div>
            )}
            {enviado && (
              <button onClick={() => setEnviado(false)} className="w-full text-center text-xs underline mt-2" style={{ color: T.inkDim }}>
                usar otro email
              </button>
            )}
          </>
        ) : (
          <>
            <p className="text-center text-sm mb-6" style={{ color: T.inkDim }}>
              Para varios dispositivos en el mismo bar, sin depender del mail cada vez. La contraseña se configura desde "Mi panel", después de entrar la primera vez con el link.
            </p>
            <div className="rounded-2xl p-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
              <div className="flex flex-col gap-2.5">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  type="email"
                  className="px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                />
                <input
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder="Contraseña"
                  type="password"
                  className="px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                />
                <button
                  onClick={entrarConClave}
                  disabled={loading}
                  className="py-2.5 rounded-xl font-black text-sm transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                  style={{
                    background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`,
                    color: T.ink,
                    boxShadow: `0 6px 16px ${T.gold}44`,
                  }}
                >
                  {loading ? "Entrando…" : "Entrar"}
                </button>
                <button
                  onClick={recuperarClave}
                  disabled={recuperando}
                  className="text-center text-xs underline mt-1 disabled:opacity-60"
                  style={{ color: T.inkDim }}
                >
                  {recuperando ? "Enviando…" : "¿Olvidaste tu contraseña?"}
                </button>
                {recuperoMsg && (
                  <p className="text-xs text-center" style={{ color: T.goldBright }}>
                    {recuperoMsg}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {error && (
          <p className="text-sm text-center mt-3" style={{ color: T.goldBright }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
