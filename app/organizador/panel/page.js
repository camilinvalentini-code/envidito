"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "../../../lib/theme";
import { useAuth } from "../../../lib/useAuth";
import { supabase } from "../../../lib/supabaseClient";
import ThemeToggleButton from "../../../components/ThemeToggleButton";
import {
  IconEspada,
  IconBasto,
  IconOro,
  IconCopa,
  IconDoc,
  IconOjo,
  IconAtras,
  IconAdelante,
  IconAbajo,
  IconUsuario,
} from "../../../components/LineIcons";

export default function PanelOrganizador() {
  const { T } = useTheme();
  const router = useRouter();
  const { session, profile, loading: authLoading, salir } = useAuth();
  const [misTorneos, setMisTorneos] = useState([]);
  const [otros, setOtros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claveNueva, setClaveNueva] = useState("");
  const [claveMsg, setClaveMsg] = useState("");
  const [claveLoading, setClaveLoading] = useState(false);
  const [mailCopiado, setMailCopiado] = useState(false);
  const [activeTab, setActiveTab] = useState("enVivo");
  const [menuOpen, setMenuOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const EMAIL_SOPORTE = "torneotruco.cba+envidito@gmail.com";

  async function copiarMailSoporte() {
    try {
      await navigator.clipboard.writeText(EMAIL_SOPORTE);
      setMailCopiado(true);
      setTimeout(() => setMailCopiado(false), 2000);
    } catch (e) {}
  }

  async function guardarClave() {
    if (claveNueva.trim().length < 6) {
      setClaveMsg("La contraseña tiene que tener al menos 6 caracteres.");
      return;
    }
    setClaveLoading(true);
    setClaveMsg("");
    const { error } = await supabase.auth.updateUser({ password: claveNueva.trim() });
    setClaveLoading(false);
    if (error) {
      setClaveMsg("No se pudo guardar. Probá de nuevo.");
      return;
    }
    setClaveNueva("");
    setClaveMsg("Listo — ya podés usar esta contraseña en cualquier dispositivo, junto con tu email.");
  }

  const load = useCallback(async () => {
    if (!session) return;
    const { data: mios } = await supabase
      .from("tournaments")
      .select("*")
      .eq("organizador_id", session.user.id)
      .order("created_at", { ascending: false });
    const { data: todos } = await supabase
      .from("tournaments")
      .select("*")
      .neq("organizador_id", session.user.id)
      .eq("es_prueba", false)
      .order("created_at", { ascending: false })
      .limit(30);
    setMisTorneos(mios || []);
    setOtros(todos || []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (!authLoading && !session) router.push("/organizador/acceso");
    if (!authLoading && profile && profile.status !== "aprobado") router.push("/organizador/pendiente");
  }, [authLoading, session, profile, router]);

  useEffect(() => {
    load();
  }, [load]);

  if (authLoading || loading) {
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
            No pudimos confirmar tu sesión. Puede ser que el link ya se haya usado, o que haya pasado mucho tiempo
            desde que lo pediste.
          </p>
          <Link
            href="/organizador/acceso"
            className="inline-block px-5 py-2.5 rounded-2xl font-bold text-sm"
            style={{ background: T.gold, color: T.ink }}
          >
            Pedir el link de nuevo
          </Link>
        </div>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: T.bg }}>
        <div className="text-center max-w-sm">
          <p className="text-sm mb-4" style={{ color: T.ink }}>
            Tenés una sesión válida, pero todavía no existe tu perfil en la base — puede tardar unos segundos
            después de registrarte. Si esto no cambia, avisale a Camilo.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-block px-5 py-2.5 rounded-2xl font-bold text-sm"
            style={{ background: T.gold, color: T.ink }}
          >
            Volver a intentar
          </button>
        </div>
      </div>
    );
  }
  if (profile.status !== "aprobado") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: T.bg }}>
        <div className="text-center max-w-sm">
          <p className="text-sm mb-4" style={{ color: T.ink }}>
            Tu cuenta todavía está en revisión.
          </p>
          <Link
            href="/organizador/pendiente"
            className="inline-block px-5 py-2.5 rounded-2xl font-bold text-sm"
            style={{ background: T.gold, color: T.ink }}
          >
            Ver estado de mi cuenta
          </Link>
        </div>
      </div>
    );
  }

  const enVivo = misTorneos.filter((t) => t.started && !t.champion_id && !t.cerrado);
  const pendientes = misTorneos.filter((t) => !t.started);
  const finalizados = misTorneos.filter((t) => !!t.champion_id || t.cerrado);
  const TABS = [
    { key: "enVivo", label: "En vivo", list: enVivo, empty: "Ninguno corriendo ahora.", dot: T.redDim },
    { key: "pendientes", label: "Pendientes", list: pendientes, empty: "No hay ninguno esperando el sorteo.", dot: T.inkDim },
    { key: "finalizados", label: "Finalizados", list: finalizados, empty: "Todavía ninguno terminado.", dot: T.inkDim },
  ];
  const tabActual = TABS.find((t) => t.key === activeTab) || TABS[0];

  return (
    <div className="transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-5">
          <Link
            href="/"
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: T.panel, border: `1px solid ${T.line}` }}
          >
            <IconAtras color={T.ink} />
          </Link>
          <div className="flex gap-2 items-center relative">
            <ThemeToggleButton />
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: T.panel, border: `1px solid ${T.line}` }}
            >
              <IconUsuario color={T.ink} />
            </button>
            {menuOpen && (
              <div
                className="absolute top-10 right-0 rounded-2xl border shadow-lg py-1.5 z-20"
                style={{ background: T.panel, borderColor: T.line, minWidth: 170 }}
              >
                <button
                  onClick={() => { setConfigOpen(true); setMenuOpen(false); }}
                  className="block w-full text-left px-4 py-2.5 text-sm font-semibold"
                  style={{ color: T.ink }}
                >
                  Configuración
                </button>
                <button
                  onClick={salir}
                  className="block w-full text-left px-4 py-2.5 text-sm font-semibold"
                  style={{ color: T.redDim }}
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 justify-center mb-1">
          <IconEspada color={T.goldBright} size={17} />
          <IconBasto color={T.goldBright} size={17} />
          <span className="font-black text-lg" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
            Envidito
          </span>
          <IconOro color={T.goldBright} size={17} />
          <IconCopa color={T.goldBright} size={17} />
        </div>
        <h1 className="text-2xl font-black text-center" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
          Hola, {profile.nombre || profile.email}
        </h1>
        <p className="text-center text-sm mb-6" style={{ color: T.inkDim }}>
          Panel de organizador
        </p>

        <Link
          href="/crear"
          className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-base mb-6 transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`,
            color: T.ink,
            boxShadow: `0 6px 16px ${T.gold}44`,
          }}
        >
          <IconDoc color={T.ink} />
          Crear torneo nuevo
        </Link>

        <div className="flex rounded-xl p-0.5 gap-0.5 mb-4" style={{ background: T.panelLight }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors duration-200"
              style={{ background: activeTab === t.key ? T.gold : "transparent", color: activeTab === t.key ? T.ink : T.inkDim }}
            >
              {t.label} <span className="font-semibold opacity-70">({t.list.length})</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 mb-8">
          {tabActual.list.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: T.inkDim }}>
              {tabActual.empty}
            </p>
          )}
          {tabActual.list.map((t) => (
            <Link
              key={t.id}
              href={`/torneo/${t.id}/admin`}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-95"
              style={{ background: T.panel, border: `1px solid ${T.line}` }}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tabActual.dot }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate" style={{ color: T.ink }}>
                  {t.nombre}
                </div>
                <div className="text-xs" style={{ color: T.inkDim }}>
                  {t.categoria} · {t.fecha}
                  {t.encargado && ` · ${t.encargado}`}
                </div>
              </div>
              {t.champion_id && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: T.panelLight, color: T.goldBright }}
                >
                  🏆 Campeón
                </span>
              )}
              <IconAdelante color={T.inkDim} />
            </Link>
          ))}
        </div>

        <h2 className="text-xs font-black uppercase tracking-wide mb-3 pt-4 border-t" style={{ color: T.inkDim, borderColor: T.line }}>
          Otros torneos en vivo
        </h2>
        <div className="flex flex-col gap-2 mb-6">
          {otros.length === 0 && (
            <p className="text-sm" style={{ color: T.inkDim }}>
              No hay otros torneos todavía.
            </p>
          )}
          {otros.map((t) => (
            <Link
              key={t.id}
              href={`/torneo/${t.id}`}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors duration-200"
              style={{ background: T.panelLight, color: T.ink }}
            >
              <IconOjo color={T.inkDim} />
              <span className="flex-1 truncate font-semibold">{t.nombre}</span>
              <span className="text-xs flex-shrink-0" style={{ color: T.inkDim }}>
                {t.categoria}
              </span>
            </Link>
          ))}
        </div>

        <div className="rounded-2xl border overflow-hidden" style={{ background: T.panel, borderColor: T.line }}>
          <button
            onClick={() => setConfigOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5"
          >
            <span className="text-sm font-black" style={{ color: T.ink }}>
              Configuración
            </span>
            <span style={{ transform: configOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
              <IconAbajo color={T.inkDim} />
            </span>
          </button>
          {configOpen && (
            <div className="px-4 pb-4 flex flex-col gap-5">
              <div>
                <div className="text-xs font-bold mb-1" style={{ color: T.ink }}>
                  Contraseña para tu equipo
                </div>
                <p className="text-xs mb-2" style={{ color: T.inkDim }}>
                  Para que varias personas del bar entren con el mismo email desde celus distintos.
                </p>
                <div className="flex gap-2">
                  <input
                    value={claveNueva}
                    onChange={(e) => setClaveNueva(e.target.value)}
                    type="password"
                    placeholder="Nueva contraseña (mín. 6 caracteres)"
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm"
                    style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                  />
                  <button
                    onClick={guardarClave}
                    disabled={claveLoading}
                    className="px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-60 flex-shrink-0"
                    style={{ background: T.gold, color: T.ink }}
                  >
                    {claveLoading ? "..." : "Guardar"}
                  </button>
                </div>
                {claveMsg && (
                  <p className="text-xs mt-2" style={{ color: T.goldBright }}>
                    {claveMsg}
                  </p>
                )}
              </div>

              <div>
                <a
                  href={`mailto:${EMAIL_SOPORTE}?subject=Solicito%20eliminar%20mi%20cuenta%20de%20Envidito&body=Hola%2C%20quiero%20eliminar%20mi%20cuenta%20y%20mis%20datos.%20Mi%20email%20de%20organizador%20es%3A%20`}
                  onClick={copiarMailSoporte}
                  className="text-xs font-semibold"
                  style={{ color: T.redDim }}
                >
                  Solicitar eliminar mi cuenta
                </a>
                {mailCopiado && (
                  <p className="text-xs mt-1" style={{ color: T.goldBright }}>
                    ¡Copiado! Pegalo en un mail a {EMAIL_SOPORTE}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
