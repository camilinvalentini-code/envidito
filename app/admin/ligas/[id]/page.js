"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "../../../../lib/theme";
import { useAuth } from "../../../../lib/useAuth";
import { supabase } from "../../../../lib/supabaseClient";
import ThemeToggleButton from "../../../../components/ThemeToggleButton";
import { IconAtras } from "../../../../components/LineIcons";

const LIGA_PUNTOS_MAX = 30;

// En truco no existe un resultado tipo "3 a 2": el que gana siempre
// llega al puntaje máximo (30). Así que acá solo se elige quién ganó,
// y con cuántos puntos quedó el que perdió.
function CargarResultadoManual({ T, partido, nombreLocal, nombreVisitante, onGuardado }) {
  const [abierto, setAbierto] = useState(false);
  const [ganador, setGanador] = useState(null); // "A" | "B" | null
  const [perdedor, setPerdedor] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!ganador) {
      setError("Elegí quién ganó.");
      return;
    }
    const pp = parseInt(perdedor, 10);
    if (isNaN(pp) || pp < 0 || pp >= LIGA_PUNTOS_MAX) {
      setError(`El que perdió tiene que tener entre 0 y ${LIGA_PUNTOS_MAX - 1}.`);
      return;
    }
    setError("");
    setGuardando(true);
    const { error: err } = await supabase.rpc("cargar_resultado_liga", {
      p_partido_id: partido.id,
      p_puntos_local: ganador === "A" ? LIGA_PUNTOS_MAX : pp,
      p_puntos_visitante: ganador === "B" ? LIGA_PUNTOS_MAX : pp,
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
        onClick={() => setAbierto(true)}
        className="flex-1 text-xs font-bold py-2 rounded-lg"
        style={{ background: "transparent", color: T.inkDim, border: `1px solid ${T.line}` }}
      >
        Cargar resultado a mano
      </button>
    );
  }

  return (
    <div className="mt-1.5 w-full">
      <div className="text-xs mb-1.5" style={{ color: T.inkDim }}>
        ¿Quién ganó? (llega a {LIGA_PUNTOS_MAX})
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => setGanador("A")}
          className="flex-1 text-center text-xs font-bold py-2 rounded-lg truncate"
          style={
            ganador === "A"
              ? { background: T.gold, color: T.ink }
              : { background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }
          }
        >
          {nombreLocal}
        </button>
        <button
          onClick={() => setGanador("B")}
          className="flex-1 text-center text-xs font-bold py-2 rounded-lg truncate"
          style={
            ganador === "B"
              ? { background: T.gold, color: T.ink }
              : { background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }
          }
        >
          {nombreVisitante}
        </button>
      </div>
      {ganador && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs flex-shrink-0" style={{ color: T.inkDim }}>
            Perdió con:
          </span>
          <input
            value={perdedor}
            onChange={(e) => setPerdedor(e.target.value.replace(/\D/g, "").slice(0, 2))}
            inputMode="numeric"
            placeholder="0"
            className="w-14 flex-shrink-0 text-center px-1 py-2 rounded-lg text-sm"
            style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
          />
          <span className="text-xs" style={{ color: T.inkDim }}>
            de {LIGA_PUNTOS_MAX}
          </span>
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <button
          onClick={guardar}
          disabled={guardando}
          className="flex-1 text-xs font-bold py-2 rounded-lg disabled:opacity-60"
          style={{ background: T.gold, color: T.ink }}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={() => setAbierto(false)} className="text-xs px-3 py-2" style={{ color: T.inkDim }}>
          Cancelar
        </button>
      </div>
      {error && (
        <p className="text-xs mt-1" style={{ color: T.redDim }}>
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
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

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

  async function compartirPartido(p, nombreLocal, nombreVisitante, codigoLocal, codigoVisitante) {
    const link = `${origin}/partido-liga/${p.match_token}`;
    const texto = `${liga?.nombre} — Fecha ${p.fecha_numero}\n${nombreLocal} vs ${nombreVisitante}\n\nAnotá los puntos acá con el código de tu equipo:\n${link}\n\nCódigo ${nombreLocal}: ${codigoLocal}\nCódigo ${nombreVisitante}: ${codigoVisitante}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: texto });
      } catch (e) {
        return;
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
    }
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
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1 text-sm font-bold" style={{ color: T.ink }}>
                                <span className="truncate">{equiposById[p.equipo_local_id]?.nombre}</span>
                                <span className="flex-shrink-0 text-xs font-bold" style={{ color: T.inkDim }}>
                                  vs
                                </span>
                                <span className="truncate">{equiposById[p.equipo_visitante_id]?.nombre}</span>
                              </div>
                            </div>
                            {p.jugado ? (
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs font-bold" style={{ color: T.goldBright }}>
                                  {p.puntos_local}-{p.puntos_visitante}
                                </span>
                                <Link href={`/partido-liga/${p.match_token}`} className="text-xs font-bold" style={{ color: T.inkDim }}>
                                  Editar en el anotador →
                                </Link>
                              </div>
                            ) : (
                              <>
                                <div className="flex gap-1.5 mt-2">
                                  <Link
                                    href={`/partido-liga/${p.match_token}`}
                                    className="flex-1 text-center text-xs font-bold py-2 rounded-lg"
                                    style={{ background: T.panelLight, color: T.goldBright }}
                                  >
                                    Abrir anotador →
                                  </Link>
                                  <button
                                    onClick={() =>
                                      compartirPartido(
                                        p,
                                        equiposById[p.equipo_local_id]?.nombre,
                                        equiposById[p.equipo_visitante_id]?.nombre,
                                        equiposById[p.equipo_local_id]?.codigo,
                                        equiposById[p.equipo_visitante_id]?.codigo
                                      )
                                    }
                                    className="px-4 text-xs font-bold rounded-lg"
                                    style={{ background: "#81C784", color: "#1B3A2A" }}
                                  >
                                    Compartir
                                  </button>
                                </div>
                                <div className="flex mt-1.5">
                                  <CargarResultadoManual
                                    T={T}
                                    partido={p}
                                    nombreLocal={equiposById[p.equipo_local_id]?.nombre}
                                    nombreVisitante={equiposById[p.equipo_visitante_id]?.nombre}
                                    onGuardado={loadPartidos}
                                  />
                                </div>
                              </>
                            )}
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
          <EquiposTab T={T} ligaId={ligaId} liga={liga} equipos={equipos} onCambio={load} />
        )}

        {tab === "solicitudes" && (
          <SolicitudesTab T={T} ligaId={ligaId} liga={liga} solicitudes={solicitudes} onCambio={load} />
        )}
      </div>
    </div>
  );
}

function IconWhatsApp({ color = "#1B3A2A", size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2zm5.6 14.3c-.2.6-1.4 1.2-1.9 1.3-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-5-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3.1 0-1.5.8-2.2 1.1-2.5.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.2.6.7 1.9.8 2 .1.2.1.3 0 .5-.1.2-.2.3-.3.5-.2.2-.3.3-.5.5-.2.2-.3.4-.1.7.2.3.9 1.5 1.9 2.4 1.3 1.2 2.4 1.5 2.7 1.7.3.2.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.2.7-.1.3.1 1.8.8 2.1 1 .3.1.5.2.6.3.1.2.1.9-.1 1.6z" />
    </svg>
  );
}

function IconLapiz({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20l1-4 11-11 3 3-11 11-4 1z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBasura({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M9 7V4.5a1 1 0 011-1h4a1 1 0 011 1V7m-9 0l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EquiposTab({ T, ligaId, liga, equipos, onCambio }) {
  const requeridos = { "1v1": 1, "2v2": 2, "3v3": 3 }[liga?.categoria] || 1;
  const maximo = requeridos + 1; // un suplente de margen

  const [nombre, setNombre] = useState("");
  const [integrantes, setIntegrantes] = useState(
    Array.from({ length: requeridos }, () => ({ nombre: "", whatsapp: "" }))
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);
  const [orden, setOrden] = useState("nombre_asc");

  const equiposOrdenados = [...equipos].sort((a, b) => {
    if (orden === "nombre_asc") return a.nombre.localeCompare(b.nombre);
    if (orden === "nombre_desc") return b.nombre.localeCompare(a.nombre);
    if (orden === "creado_asc") return new Date(a.created_at) - new Date(b.created_at);
    return new Date(b.created_at) - new Date(a.created_at); // creado_desc
  });

  useEffect(() => {
    if (liga?.categoria) {
      setIntegrantes(Array.from({ length: requeridos }, () => ({ nombre: "", whatsapp: "" })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liga?.categoria]);

  async function eliminarEquipo(id) {
    await supabase.rpc("eliminar_equipo_liga", { p_equipo_id: id });
    setConfirmarBorrar(null);
    onCambio();
  }

  function setIntegrante(i, campo, valor) {
    let limpio = valor;
    if (campo === "whatsapp") limpio = valor.replace(/[^0-9+\-\s]/g, "");
    if (campo === "nombre") limpio = valor.replace(/[^a-zA-ZÀ-ÿñÑ\s'-]/g, "");
    setIntegrantes((arr) => arr.map((it, idx) => (idx === i ? { ...it, [campo]: limpio } : it)));
  }
  function agregarFila() {
    setIntegrantes((arr) => (arr.length >= maximo ? arr : [...arr, { nombre: "", whatsapp: "" }]));
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
    if (limpios.length < requeridos || limpios.length > maximo) {
      setError(`Esta liga es ${liga?.categoria}: cargá entre ${requeridos} y ${maximo} integrantes (el extra es por si hay suplente).`);
      return;
    }
    if (
      !limpios.some((it) => {
        const d = it.whatsapp.replace(/\D/g, "").length;
        return d >= 10 && d <= 13;
      })
    ) {
      setError("Cargá un WhatsApp válido (código de área + número, ej: 351X XX-XXXX) de al menos un integrante.");
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
    setIntegrantes(Array.from({ length: requeridos }, () => ({ nombre: "", whatsapp: "" })));
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
          Integrantes <span style={{ color: T.goldBright, fontWeight: 700 }}>— Obligatorio al menos 1 WhatsApp.</span>
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
        {integrantes.length < maximo && (
          <button onClick={agregarFila} className="text-xs font-bold mb-3" style={{ color: T.goldBright }}>
            + Agregar suplente
          </button>
        )}
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

      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs font-extrabold uppercase tracking-wide" style={{ color: T.inkDim }}>
          Equipos anotados ({equipos.length})
        </div>
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg font-bold"
          style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
        >
          <option value="nombre_asc">Nombre A-Z</option>
          <option value="nombre_desc">Nombre Z-A</option>
          <option value="creado_asc">Primero anotado</option>
          <option value="creado_desc">Último anotado</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        {equiposOrdenados.map((eq) => {
          const contacto = (eq.liga_integrantes || []).find((it) => it.whatsapp && it.whatsapp.trim());
          const numero = contacto ? contacto.whatsapp.replace(/\D/g, "") : null;
          const texto = encodeURIComponent(`¡Hola equipo ${eq.nombre}! Te escribo por la liga ${liga?.nombre || ""}.`);
          const waLink = numero ? `https://wa.me/${numero}?text=${texto}` : null;
          return (
            <div
              key={eq.id}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
              style={{ background: T.panel, border: `1px solid ${T.line}` }}
            >
              <Link href={`/admin/ligas/${ligaId}/equipo/${eq.id}`} className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate" style={{ color: T.ink }}>
                  {eq.nombre}
                </div>
                <div className="text-xs" style={{ color: T.inkDim }}>
                  {(eq.liga_integrantes || []).length} integrante(s) · código {eq.codigo}
                </div>
              </Link>
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  title={`Escribirle a ${contacto.nombre} por WhatsApp`}
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-200 hover:scale-110"
                  style={{ background: "#81C784" }}
                >
                  <IconWhatsApp />
                </a>
              )}
              {confirmarBorrar === eq.id ? (
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => eliminarEquipo(eq.id)}
                    className="text-xs font-bold px-2 py-1.5 rounded-lg"
                    style={{ background: T.redDim, color: "#FFFFFF" }}
                  >
                    Confirmar
                  </button>
                  <button onClick={() => setConfirmarBorrar(null)} className="text-xs px-1.5" style={{ color: T.inkDim }}>
                    No
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    href={`/admin/ligas/${ligaId}/equipo/${eq.id}?editar=1`}
                    title="Editar equipo"
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: T.panelLight }}
                  >
                    <IconLapiz color={T.goldBright} />
                  </Link>
                  <button
                    onClick={() => setConfirmarBorrar(eq.id)}
                    title="Eliminar equipo"
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: T.panelLight }}
                  >
                    <IconBasura color={T.redDim} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SolicitudesTab({ T, ligaId, liga, solicitudes, onCambio }) {
  const requeridos = { "1v1": 1, "2v2": 2, "3v3": 3 }[liga?.categoria] || 1;
  const [probando, setProbando] = useState(false);
  const [nombreEquipo, setNombreEquipo] = useState("");
  const [integrantes, setIntegrantes] = useState(Array.from({ length: requeridos }, () => ""));
  const [nombreContacto, setNombreContacto] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    if (liga?.categoria) setIntegrantes(Array.from({ length: requeridos }, () => ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liga?.categoria]);

  const [error, setError] = useState("");

  function setNombreIntegrante(i, valor) {
    const limpio = valor.replace(/[^a-zA-ZÀ-ÿñÑ\s'-]/g, "");
    setIntegrantes((arr) => arr.map((v, idx) => (idx === i ? limpio : v)));
  }

  async function crearDePrueba() {
    if (!nombreEquipo.trim()) {
      setError("Ponele nombre al equipo.");
      return;
    }
    setError("");
    const integrantesLimpios = integrantes.filter((n) => n.trim()).map((n) => ({ nombre: n.trim(), whatsapp: null }));
    const { error: err } = await supabase.rpc("crear_solicitud_liga", {
      p_liga_id: ligaId,
      p_nombre_equipo: nombreEquipo.trim(),
      p_nombre_contacto: nombreContacto.trim() || null,
      p_whatsapp: whatsapp.trim() || null,
      p_integrantes: integrantesLimpios.length ? integrantesLimpios : null,
    });
    if (err) {
      setError("No se pudo guardar la solicitud. Probá de nuevo.");
      console.error(err);
      return;
    }
    setNombreEquipo("");
    setIntegrantes(Array.from({ length: requeridos }, () => ""));
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
          <div className="grid grid-cols-2 gap-1.5">
            {integrantes.map((valor, i) => (
              <input
                key={i}
                value={valor}
                onChange={(e) => setNombreIntegrante(i, e.target.value)}
                placeholder={`Integrante`}
                className="px-2.5 py-1.5 rounded-lg text-xs"
                style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              value={nombreContacto}
              onChange={(e) => setNombreContacto(e.target.value)}
              placeholder="Nombre de contacto"
              className="px-2.5 py-1.5 rounded-lg text-xs"
              style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
            />
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.replace(/[^0-9+\-\s]/g, ""))}
              placeholder="WhatsApp"
              className="px-2.5 py-1.5 rounded-lg text-xs"
              style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
            />
          </div>
          {error && (
            <p className="text-xs" style={{ color: T.redDim }}>
              {error}
            </p>
          )}
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
