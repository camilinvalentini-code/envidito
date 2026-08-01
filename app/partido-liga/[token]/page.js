"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTheme } from "../../../lib/theme";
import { useSkin } from "../../../lib/scoreboardSkin";
import { supabase } from "../../../lib/supabaseClient";
import { fraseCampeonAlAzar } from "../../../lib/champFrases";
import { useWakeLock } from "../../../lib/useWakeLock";
import Scoreboard from "../../../components/Scoreboard";
import ThemeToggleButton from "../../../components/ThemeToggleButton";
import { IconAtras } from "../../../components/LineIcons";

const PUNTOS_MAX = 30;

function claveCodigo(partidoId) {
  return `torneotruco:codigo-liga:${partidoId}`;
}

export default function PartidoLigaPage({ params }) {
  const { token } = params;
  useWakeLock();
  const { T } = useTheme();
  const { layout, marks, setLayout, setMarks } = useSkin();
  const [partido, setPartido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [yaConfirmeLocal, setYaConfirmeLocal] = useState(false);
  const [codigo, setCodigo] = useState(null);
  const [codigoInput, setCodigoInput] = useState("");
  const [codigoError, setCodigoError] = useState(null);
  const [verificando, setVerificando] = useState(false);
  const [accionError, setAccionError] = useState(null);
  const desbloqueado = !!codigo;

  function esErrorDeCodigo(error) {
    return !!error?.message && error.message.includes("código inválido");
  }

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("partido_liga_por_token", { p_token: token });
    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setPartido(data);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!partido?.id) return;
    try {
      const guardado = window.localStorage.getItem(claveCodigo(partido.id));
      if (guardado) setCodigo(guardado);
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partido?.id]);

  // Sin realtime acá (la tabla liga_partidos no es pública): en vez de
  // eso, se refresca solo cada pocos segundos para que las dos mesas
  // vean el marcador actualizado sin tener que recargar a mano.
  useEffect(() => {
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load]);

  async function verificarCodigo() {
    const limpio = codigoInput.trim();
    if (!limpio) return;
    setVerificando(true);
    setCodigoError(null);
    const { data, error } = await supabase.rpc("validar_codigo_liga", { p_token: token, p_codigo: limpio });
    if (!error && data === true) {
      try {
        window.localStorage.setItem(claveCodigo(partido.id), limpio);
      } catch (e) {}
      setCodigo(limpio);
      setCodigoInput("");
    } else {
      setCodigoError("Código incorrecto. Fijate que sea el que te dio la organización.");
    }
    setVerificando(false);
  }

  function onCodigoRechazado() {
    try {
      if (partido?.id) window.localStorage.removeItem(claveCodigo(partido.id));
    } catch (e) {}
    setCodigo(null);
    setCodigoError("Tu código ya no es válido. Ingresalo de nuevo.");
  }

  async function onChange(side, delta) {
    if (!partido || busy || partido.ganador_id || partido.confirmacion_pendiente || !desbloqueado) return;
    const field = side === "A" ? "puntos_local" : "puntos_visitante";
    const original = partido[field];
    const proyectado = Math.max(0, Math.min(PUNTOS_MAX, original + delta));
    setAccionError(null);

    if (delta > 0 && proyectado >= PUNTOS_MAX) {
      setBusy(true);
      const { data, error } = await supabase.rpc("proponer_cierre_liga", { p_token: token, p_lado: side, p_codigo: codigo });
      if (!error && data) {
        setPartido(data);
        setYaConfirmeLocal(true);
      } else if (error) {
        if (esErrorDeCodigo(error)) onCodigoRechazado();
        else setAccionError("No se pudo guardar. Probá de nuevo.");
      }
      setBusy(false);
      return;
    }

    setBusy(true);
    setPartido((p) => ({ ...p, [field]: proyectado }));
    const { data, error } = await supabase.rpc("anotar_punto_liga", {
      p_token: token,
      p_lado: side,
      p_delta: delta,
      p_codigo: codigo,
    });
    if (!error && data) {
      setPartido(data);
    } else if (error) {
      setPartido((p) => ({ ...p, [field]: original }));
      if (esErrorDeCodigo(error)) onCodigoRechazado();
      else setAccionError("No se pudo guardar ese punto. Probá de nuevo.");
    }
    setBusy(false);
  }

  async function confirmarCierre() {
    if (!desbloqueado) return;
    setBusy(true);
    setAccionError(null);
    const { data, error } = await supabase.rpc("confirmar_cierre_liga", { p_token: token, p_codigo: codigo });
    if (!error && data) {
      setPartido(data);
      setYaConfirmeLocal(true);
    } else if (error) {
      if (esErrorDeCodigo(error)) onCodigoRechazado();
      else setAccionError("No se pudo confirmar. Probá de nuevo.");
    }
    setBusy(false);
  }

  async function cancelarCierre() {
    if (!desbloqueado) return;
    setBusy(true);
    setAccionError(null);
    const { data, error } = await supabase.rpc("cancelar_cierre_liga", { p_token: token, p_codigo: codigo });
    if (!error && data) {
      setPartido(data);
      setYaConfirmeLocal(false);
    } else if (error) {
      if (esErrorDeCodigo(error)) onCodigoRechazado();
      else setAccionError("No se pudo cancelar. Probá de nuevo.");
    }
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.ink }}>
        Cargando la mesa…
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6" style={{ background: T.bg, color: T.ink }}>
        No encontramos este partido. Puede que el link esté mal copiado.
      </div>
    );
  }

  const nameA = partido.equipo_local_nombre || "Equipo A";
  const nameB = partido.equipo_visitante_nombre || "Equipo B";
  const winnerName = partido.ganador_id === partido.equipo_local_id ? nameA : partido.ganador_id === partido.equipo_visitante_id ? nameB : null;

  return (
    <div className="transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          <Link
            href="/"
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: T.panel, border: `1px solid ${T.line}` }}
          >
            <IconAtras color={T.ink} />
          </Link>
          <ThemeToggleButton />
        </div>
        <h1 className="text-xl font-black text-center mb-1" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
          Anotador de liga
        </h1>
        <p className="text-center text-xs mb-5" style={{ color: T.inkDim }}>
          {partido.liga_nombre} · {partido.etapa_nombre} · Fecha {partido.fecha_numero}
        </p>

        {winnerName && (
          <div
            className="rounded-3xl p-5 mb-5 text-center border-2 shadow-md"
            style={{ background: "#FBF3E3", borderColor: "#EAC27A" }}
          >
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#B85C55" }}>
              Ganó
            </div>
            <div className="text-xl font-black mt-1" style={{ color: "#33453E" }}>
              {winnerName}
            </div>
            <div className="text-xs mt-1 italic" style={{ color: "#B85C55" }}>
              {fraseCampeonAlAzar()}
            </div>
          </div>
        )}

        {!desbloqueado && !partido.ganador_id && (
          <div
            className="rounded-2xl p-4 mb-5 text-center border shadow-sm"
            style={{ background: T.panel, borderColor: T.line }}
          >
            <p className="text-sm font-bold mb-1" style={{ color: T.ink }}>
              🔒 Este partido está protegido
            </p>
            <p className="text-xs mb-3" style={{ color: T.inkDim }}>
              Para anotar puntos hace falta el código de {nameA} o de {nameB}. Podés seguir el marcador igual, sin
              código — solo hace falta para tocar los botones.
            </p>
            <div className="flex gap-2 justify-center">
              <input
                value={codigoInput}
                onChange={(e) => setCodigoInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verificarCodigo()}
                placeholder="Código de tu equipo"
                inputMode="numeric"
                className="px-3 py-2 rounded-xl text-sm text-center w-40"
                style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
              />
              <button
                onClick={verificarCodigo}
                disabled={verificando || !codigoInput.trim()}
                className="px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-40"
                style={{ background: T.gold, color: T.ink }}
              >
                {verificando ? "..." : "Desbloquear"}
              </button>
            </div>
            {codigoError && (
              <p className="text-xs mt-2" style={{ color: "#B85C55" }}>
                {codigoError}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-center flex-wrap mb-4">
          <button
            onClick={() => setLayout("apilado")}
            className="text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors duration-150"
            style={{
              background: layout === "apilado" ? T.gold : T.panel,
              color: layout === "apilado" ? T.ink : T.inkDim,
              border: `1px solid ${T.line}`,
            }}
          >
            Apilado
          </button>
          <button
            onClick={() => setLayout("vertical")}
            className="text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors duration-150"
            style={{
              background: layout === "vertical" ? T.gold : T.panel,
              color: layout === "vertical" ? T.ink : T.inkDim,
              border: `1px solid ${T.line}`,
            }}
          >
            Vertical
          </button>
          <span style={{ color: T.inkDim, fontSize: 11 }}>·</span>
          <button
            onClick={() => setMarks("palito")}
            className="text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors duration-150"
            style={{
              background: marks === "palito" ? T.gold : T.panel,
              color: marks === "palito" ? T.ink : T.inkDim,
              border: `1px solid ${T.line}`,
            }}
          >
            Palitos
          </button>
          <button
            onClick={() => setMarks("fosforo")}
            className="text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors duration-150"
            style={{
              background: marks === "fosforo" ? T.gold : T.panel,
              color: marks === "fosforo" ? T.ink : T.inkDim,
              border: `1px solid ${T.line}`,
            }}
          >
            Fósforos
          </button>
        </div>

        {partido.confirmacion_pendiente && (
          <div
            className="rounded-2xl p-4 mb-4 text-center border-2 shadow-md"
            style={{ background: "#FBF3E3", borderColor: "#EAC27A" }}
          >
            <p className="text-sm font-bold mb-1" style={{ color: "#33453E" }}>
              ¿Confirmás que "{partido.lado_propuesto === "A" ? nameA : nameB}" ganó {PUNTOS_MAX} puntos? Esto cierra
              el partido.
            </p>
            <p className="text-xs mb-3" style={{ color: "#B85C55" }}>
              {!desbloqueado
                ? "Necesitás el código de tu equipo (arriba) para confirmar o cancelar."
                : yaConfirmeLocal
                ? "Ya confirmaste desde este celular — falta que confirmen desde el otro."
                : "Hace falta que confirmen las dos mesas."}
            </p>
            {desbloqueado && (
              <div className="flex gap-2 justify-center">
                <button
                  onClick={confirmarCierre}
                  disabled={busy || yaConfirmeLocal}
                  className="px-5 py-2 rounded-xl font-bold text-sm disabled:opacity-40"
                  style={{ background: "#EAC27A", color: "#33453E" }}
                >
                  {yaConfirmeLocal ? "Ya confirmaste ✓" : "Confirmar"}
                </button>
                <button
                  onClick={cancelarCierre}
                  disabled={busy}
                  className="px-5 py-2 rounded-xl font-bold text-sm disabled:opacity-60"
                  style={{ background: "transparent", color: "#B85C55", border: "1px solid #B85C55" }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}

        <Scoreboard
          nameA={nameA}
          nameB={nameB}
          scoreA={partido.puntos_local}
          scoreB={partido.puntos_visitante}
          onChange={onChange}
          disabled={busy || !!partido.ganador_id || partido.confirmacion_pendiente || !desbloqueado}
          layout={layout}
          marks={marks}
          maxScore={PUNTOS_MAX}
        />

        {busy && (
          <p className="text-center text-xs mt-2" style={{ color: T.inkDim }}>
            Guardando…
          </p>
        )}
        {accionError && (
          <p className="text-center text-xs mt-2 font-semibold" style={{ color: "#B85C55" }}>
            {accionError}
          </p>
        )}
      </div>
    </div>
  );
}
