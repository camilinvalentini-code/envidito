"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "../../../../lib/theme";
import { useAuth } from "../../../../lib/useAuth";
import { supabase } from "../../../../lib/supabaseClient";
import ThemeToggleButton from "../../../../components/ThemeToggleButton";
import { IconAtras } from "../../../../components/LineIcons";

function ResultadoForm({ T, partido, onGuardado }) {
  const [local, setLocal] = useState("");
  const [visitante, setVisitante] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const pl = parseInt(local, 10);
    const pv = parseInt(visitante, 10);
    if (isNaN(pl) || isNaN(pv)) {
      setError("Cargá los dos puntajes.");
      return;
    }
    if (pl === pv) {
      setError("No puede haber empate.");
      return;
    }
    setError("");
    setGuardando(true);
    const { error: err } = await supabase.rpc("cargar_resultado_liga", {
      p_partido_id: partido.id,
      p_puntos_local: pl,
      p_puntos_visitante: pv,
    });
    setGuardando(false);
    if (err) {
      setError("No se pudo guardar.");
      return;
    }
    setAbierto(false);
    onGuardado();
  }

  if (!abierto) {
    return (
      <button
        onClick={() => {
          setAbierto(true);
          setLocal(partido.jugado ? String(partido.puntos_local) : "");
          setVisitante(partido.jugado ? String(partido.puntos_visitante) : "");
        }}
        className="w-full text-center text-xs font-bold mt-2 py-1.5 rounded-lg"
        style={{ background: T.panelLight, color: T.goldBright }}
      >
        {partido.jugado ? `Editar resultado (${partido.puntos_local}-${partido.puntos_visitante})` : "Cargar resultado"}
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          inputMode="numeric"
          placeholder="0"
          className="w-14 text-center px-2 py-1.5 rounded-lg text-sm"
          style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
        />
        <span className="text-xs" style={{ color: T.inkDim }}>
          -
        </span>
        <input
          value={visitante}
          onChange={(e) => setVisitante(e.target.value)}
          inputMode="numeric"
          placeholder="0"
          className="w-14 text-center px-2 py-1.5 rounded-lg text-sm"
          style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
        />
        <button
          onClick={guardar}
          disabled={guardando}
          className="flex-1 text-xs font-bold py-1.5 rounded-lg disabled:opacity-60"
          style={{ background: T.gold, color: T.ink }}
        >
          {guardando ? "..." : "Guardar"}
        </button>
        <button onClick={() => setAbierto(false)} className="text-xs px-1.5" style={{ color: T.inkDim }}>
          x
        </button>
      </div>
      {error && (
        <p className="text-xs" style={{ color: T.redDim }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function PanelLiga() {
  const { T } = useTheme();
  const router = useRouter();
  const params = useParams();
  const ligaId = params.id;
  const { session, profile, loading: authLoading } = useAuth();

  const [liga, setLiga] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [etapaId, setEtapaId] = useState(null);
  const [equipos, setEquipos] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [tab, setTab] = useState("fixture");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data: l } = await supabase.from("ligas").select("*").eq("id", ligaId).single();
    const { data: et } = await supabase.from("liga_etapas").select("*").eq("liga_id", ligaId).order("orden");
    const { data: eq } = await supabase.from("liga_equipos").select("*, liga_integrantes(*)").eq("liga_id", ligaId).order("nombre");
    const { data: sol } = await supabase
      .from("liga_solicitudes")
      .select("*")
      .eq("liga_id", ligaId)
      .order("created_at", { ascending: false });
    setLiga(l || null);
    setEtapas(et || []);
    setEquipos(eq || []);
    setSolicitudes(sol || []);
    setEtapaId((prev) => prev || (et && et[0] ? et[0].id : null));
    setLoading(false);
  }, [ligaId]);

  const loadPartidos = useCallback(async () => {
    if (!etapaId) {
      setPartidos([]);
      return;
    }
    const { data } = await supabase
      .from("liga_partidos")
      .select("*")
      .eq("etapa_id", etapaId)
      .order("fecha_numero");
    setPartidos(data || []);
  }, [etapaId]);

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
    loadPartidos();
  }, [loadPartidos]);

  async function generarFixture() {
    if (!etapaId) return;
    if (equipos.length < 2) {
      setMsg("Hacen falta al menos 2 equipos.");
      return;
    }
    setMsg("");
    const { error } = await supabase.rpc("generar_fixture_liga", { p_etapa_id: etapaId });
    if (error) {
      setMsg("No se pudo generar el fixture.");
      return;
    }
    loadPartidos();
  }

  const pendientesCount = solicitudes.filter((s) => s.estado === "pendiente").length;
  const etapaActual = etapas.find((e) => e.id === etapaId);
  const equiposById = {};
  equipos.forEach((eq) => {
    equiposById[eq.id] = eq;
  });
  const porFecha = {};
  partidos.forEach((p) => {
    porFecha[p.fecha_numero] = porFecha[p.fecha_numero] || [];
    porFecha[p.fecha_numero].push(p);
  });

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
            href="/admin/ligas"
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
          {etapaActual?.nombre} · {liga.categoria}
        </p>

        <Link
          href={`/admin/ligas/${ligaId}/tabla`}
          className="block text-center py-2 rounded-2xl font-bold text-xs mb-4"
          style={{ background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`, color: T.ink }}
        >
          Ver tabla de posiciones
        </Link>

        {etapas.length > 1 && (
          <div className="flex rounded-xl overflow-hidden p-0.5 mb-4" style={{ background: T.panelLight }}>
            {etapas.map((e) => (
              <button
                key={e.id}
                onClick={() => setEtapaId(e.id)}
                className="flex-1 py-1.5 text-xs font-bold rounded-lg"
                style={{ background: etapaId === e.id ? T.gold : "transparent", color: etapaId === e.id ? T.ink : T.inkDim }}
              >
                {e.nombre}
              </button>
            ))}
          </div>
        )}

        <div className="flex rounded-xl p-0.5 mb-4 gap-0.5" style={{ background: T.panelLight }}>
          {[
            { id: "fixture", label: "Fixture" },
            { id: "equipos", label: "Equipos" },
            { id: "solicitudes", label: "Solicitudes" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2 text-xs font-bold rounded-lg relative"
              style={{ background: tab === t.id ? T.gold : "transparent", color: tab === t.id ? T.ink : T.inkDim }}
            >
              {t.label}
              {t.id === "solicitudes" && pendientesCount > 0 && (
                <span
                  className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full"
                  style={{ background: T.redDim }}
                />
              )}
            </button>
          ))}
        </div>

        {msg && (
          <p className="text-xs text-center mb-3" style={{ color: T.redDim }}>
            {msg}
          </p>
        )}

        {tab === "fixture" && (
          <div>
            {partidos.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm mb-3" style={{ color: T.inkDim }}>
                  Todavía no hay fixture para esta etapa.
                </p>
                <button
                  onClick={generarFixture}
                  className="px-4 py-2 rounded-xl font-bold text-sm"
                  style={{ background: T.gold, color: T.ink }}
                >
                  Generar fixture (todos contra todos)
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {Object.keys(porFecha)
                  .sort((a, b) => Number(a) - Number(b))
                  .map((fn) => (
                    <div key={fn}>
                      <div className="text-xs font-extrabold uppercase tracking-wide mb-2" style={{ color: T.inkDim }}>
                        Fecha {fn}
                      </div>
                      <div className="flex flex-col gap-2">
                        {porFecha[fn].map((p) => (
                          <div key={p.id} className="rounded-xl p-3 border" style={{ background: T.panel, borderColor: T.line }}>
                            <div className="flex items-center justify-between text-sm font-bold" style={{ color: T.ink }}>
                              <span>{equiposById[p.equipo_local_id]?.nombre}</span>
                              <span className="text-xs font-bold" style={{ color: T.inkDim }}>
                                vs
                              </span>
                              <span>{equiposById[p.equipo_visitante_id]?.nombre}</span>
                            </div>
                            <ResultadoForm T={T} partido={p} onGuardado={loadPartidos} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                <button
                  onClick={generarFixture}
                  className="text-xs text-center py-2 rounded-xl font-bold"
                  style={{ background: T.panelLight, color: T.inkDim }}
                >
                  Volver a generar el fixture (se borra el actual)
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "equipos" && (
          <EquiposTab T={T} ligaId={ligaId} equipos={equipos} onCambio={load} />
        )}

        {tab === "solicitudes" && (
          <SolicitudesTab T={T} ligaId={ligaId} solicitudes={solicitudes} onCambio={load} />
        )}
      </div>
    </div>
  );
}

function EquiposTab({ T, ligaId, equipos, onCambio }) {
  const [nombre, setNombre] = useState("");
  const [integrantes, setIntegrantes] = useState([{ nombre: "", whatsapp: "" }]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function setIntegrante(i, campo, valor) {
    setIntegrantes((arr) => arr.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
  }
  function agregarFila() {
    setIntegrantes((arr) => [...arr, { nombre: "", whatsapp: "" }]);
  }
  function quitarFila(i) {
    setIntegrantes((arr) => arr.filter((_, idx) => idx !== i));
  }

  async function agregarEquipo() {
    if (!nombre.trim()) {
      setError("Ponele nombre al equipo.");
      return;
    }
    const limpios = integrantes.filter((it) => it.nombre.trim());
    if (!limpios.some((it) => it.whatsapp.trim())) {
      setError("Cargá el WhatsApp de al menos un integrante.");
      return;
    }
    setError("");
    setGuardando(true);
    const { error: err } = await supabase.rpc("agregar_equipo_liga", {
      p_liga_id: ligaId,
      p_nombre: nombre.trim(),
      p_integrantes: limpios.length ? limpios : null,
    });
    setGuardando(false);
    if (err) {
      setError("No se pudo agregar el equipo.");
      return;
    }
    setNombre("");
    setIntegrantes([{ nombre: "", whatsapp: "" }]);
    onCambio();
  }

  return (
    <div>
      <div className="rounded-2xl p-4 border mb-5" style={{ background: T.panel, borderColor: T.line }}>
        <div className="text-xs font-bold mb-2" style={{ color: T.inkDim }}>
          Agregar equipo
        </div>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del equipo*"
          className="w-full px-3 py-2 rounded-xl text-sm mb-2"
          style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
        />
        <div className="text-xs font-bold mb-1.5" style={{ color: T.inkDim }}>
          Integrantes <span style={{ color: T.goldBright, fontWeight: 700 }}>(WhatsApp de al menos uno es obligatorio)</span>
        </div>
        <div className="flex flex-col gap-1.5 mb-2">
          {integrantes.map((it, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                value={it.nombre}
                onChange={(e) => setIntegrante(i, "nombre", e.target.value)}
                placeholder="Nombre"
                className="flex-1 px-2.5 py-1.5 rounded-lg text-xs"
                style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
              />
              <input
                value={it.whatsapp}
                onChange={(e) => setIntegrante(i, "whatsapp", e.target.value)}
                placeholder="WhatsApp"
                className="flex-1 px-2.5 py-1.5 rounded-lg text-xs"
                style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
              />
              {integrantes.length > 1 && (
                <button onClick={() => quitarFila(i)} className="text-xs px-1" style={{ color: T.redDim }}>
                  x
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={agregarFila} className="text-xs font-bold mb-3" style={{ color: T.goldBright }}>
          + Agregar integrante
        </button>
        {error && (
          <p className="text-xs mb-2" style={{ color: T.redDim }}>
            {error}
          </p>
        )}
        <button
          onClick={agregarEquipo}
          disabled={guardando}
          className="w-full py-2.5 rounded-xl font-bold text-sm disabled:opacity-60"
          style={{ background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`, color: T.ink }}
        >
          {guardando ? "Agregando…" : "Agregar equipo"}
        </button>
      </div>

      <div className="text-xs font-extrabold uppercase tracking-wide mb-2" style={{ color: T.inkDim }}>
        Equipos anotados ({equipos.length})
      </div>
      <div className="flex flex-col gap-2">
        {equipos.map((eq) => (
          <Link
            key={eq.id}
            href={`/admin/ligas/${ligaId}/equipo/${eq.id}`}
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
            style={{ background: T.panel, border: `1px solid ${T.line}` }}
          >
            <div>
              <div className="text-sm font-bold" style={{ color: T.ink }}>
                {eq.nombre}
              </div>
              <div className="text-xs" style={{ color: T.inkDim }}>
                {(eq.liga_integrantes || []).length} integrante(s) · código {eq.codigo}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SolicitudesTab({ T, ligaId, solicitudes, onCambio }) {
  const [probando, setProbando] = useState(false);
  const [nombreEquipo, setNombreEquipo] = useState("");
  const [nombreContacto, setNombreContacto] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  async function crearDePrueba() {
    if (!nombreEquipo.trim()) return;
    await supabase.rpc("crear_solicitud_liga", {
      p_liga_id: ligaId,
      p_nombre_equipo: nombreEquipo.trim(),
      p_nombre_contacto: nombreContacto.trim() || null,
      p_whatsapp: whatsapp.trim() || null,
    });
    setNombreEquipo("");
    setNombreContacto("");
    setWhatsapp("");
    setProbando(false);
    onCambio();
  }

  async function aprobar(id) {
    await supabase.rpc("aprobar_solicitud_liga", { p_solicitud_id: id });
    onCambio();
  }
  async function rechazar(id) {
    await supabase.rpc("rechazar_solicitud_liga", { p_solicitud_id: id });
    onCambio();
  }

  return (
    <div>
      <p className="text-xs mb-3" style={{ color: T.inkDim }}>
        Todavía no hay formulario público — cuando alguien te escribe por WhatsApp pidiendo sumarse, la cargás vos acá.
      </p>

      {!probando ? (
        <button
          onClick={() => setProbando(true)}
          className="text-xs font-bold mb-4"
          style={{ color: T.goldBright }}
        >
          + Cargar solicitud
        </button>
      ) : (
        <div className="rounded-2xl p-3.5 border mb-4 flex flex-col gap-1.5" style={{ background: T.panel, borderColor: T.line }}>
          <input
            value={nombreEquipo}
            onChange={(e) => setNombreEquipo(e.target.value)}
            placeholder="Nombre del equipo*"
            className="px-2.5 py-1.5 rounded-lg text-xs"
            style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
          />
          <input
            value={nombreContacto}
            onChange={(e) => setNombreContacto(e.target.value)}
            placeholder="Nombre de contacto"
            className="px-2.5 py-1.5 rounded-lg text-xs"
            style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
          />
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="WhatsApp"
            className="px-2.5 py-1.5 rounded-lg text-xs"
            style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
          />
          <div className="flex gap-2 mt-1">
            <button onClick={crearDePrueba} className="flex-1 text-xs font-bold py-1.5 rounded-lg" style={{ background: T.gold, color: T.ink }}>
              Guardar
            </button>
            <button onClick={() => setProbando(false)} className="text-xs px-2" style={{ color: T.inkDim }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {solicitudes.length === 0 ? (
        <p className="text-center text-sm" style={{ color: T.inkDim }}>
          No hay solicitudes todavía.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {solicitudes.map((s) => (
            <div key={s.id} className="rounded-xl p-3 border" style={{ background: T.panel, borderColor: T.line }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: T.ink }}>
                  {s.nombre_equipo}
                </span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: s.estado === "pendiente" ? T.panelLight : "transparent",
                    color: s.estado === "pendiente" ? T.goldBright : T.inkDim,
                  }}
                >
                  {s.estado}
                </span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: T.inkDim }}>
                {[s.nombre_contacto, s.whatsapp].filter(Boolean).join(" · ")}
              </div>
              {s.estado === "pendiente" && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => aprobar(s.id)}
                    className="flex-1 text-xs font-bold py-1.5 rounded-lg"
                    style={{ background: T.gold, color: T.ink }}
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => rechazar(s.id)}
                    className="flex-1 text-xs font-bold py-1.5 rounded-lg"
                    style={{ background: T.panelLight, color: T.redDim }}
                  >
                    Rechazar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
