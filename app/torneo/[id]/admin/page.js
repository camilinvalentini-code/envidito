"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "../../../../lib/theme";
import { useAuth } from "../../../../lib/useAuth";
import { supabase } from "../../../../lib/supabaseClient";
import TeamList from "../../../../components/TeamList";
import BracketDisplay from "../../../../components/BracketDisplay";
import ThemeToggleButton from "../../../../components/ThemeToggleButton";
import { IconAtras, IconAbajo } from "../../../../components/LineIcons";
import { fraseCampeonAlAzar } from "../../../../lib/champFrases";
import { roundLabel } from "../../../../lib/bracket";

export default function AdminPage({ params }) {
  const { id } = params;
  const { T } = useTheme();
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();

  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [jugadorInput, setJugadorInput] = useState("");
  const [jugadoresChips, setJugadoresChips] = useState([]); // [{id?, name}]
  const [sugerencias, setSugerencias] = useState([]);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");
  const [editandoInfo, setEditandoInfo] = useState(false);
  const [infoNombre, setInfoNombre] = useState("");
  const [infoUbicacion, setInfoUbicacion] = useState("");
  const [infoFecha, setInfoFecha] = useState("");
  const [infoEncargado, setInfoEncargado] = useState("");
  const [vista, setVista] = useState("mesas"); // "mesas" | "cuadro"
  const [simulando, setSimulando] = useState(false);
  const [mostrarEquipos, setMostrarEquipos] = useState(false);
  const [busquedaEquipos, setBusquedaEquipos] = useState("");
  const [mostrarQuitarEquipo, setMostrarQuitarEquipo] = useState(false);
  const [nombreNuevoEquipo, setNombreNuevoEquipo] = useState("");
  const [formatoElegido, setFormatoElegido] = useState("directa"); // "directa" | "grupos"
  const [cantidadGrupos, setCantidadGrupos] = useState(4);
  const [clasificanPorGrupo, setClasificanPorGrupo] = useState(2);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    const { data: t } = await supabase.from("tournaments").select("*").eq("id", id).single();
    if (!t) {
      setLoading(false);
      return;
    }
    const { data: ts } = await supabase.from("teams").select("*").eq("tournament_id", id).order("created_at");
    const { data: ms } = await supabase.from("matches").select("*").eq("tournament_id", id);

    const teamIds = (ts || []).map((tm) => tm.id);
    let teamsConJugadores = ts || [];
    if (teamIds.length > 0) {
      const { data: tp } = await supabase
        .from("team_players")
        .select("team_id, players(name)")
        .in("team_id", teamIds);
      const porEquipo = {};
      (tp || []).forEach((row) => {
        porEquipo[row.team_id] = porEquipo[row.team_id] || [];
        if (row.players?.name) porEquipo[row.team_id].push(row.players.name);
      });
      teamsConJugadores = (ts || []).map((tm) => ({
        ...tm,
        players: porEquipo[tm.id]?.length ? porEquipo[tm.id].join(", ") : tm.players,
      }));
    }

    setTournament(t);
    setTeams(teamsConJugadores);
    setMatches(ms || []);
    setLoading(false);
    setInfoNombre((prev) => prev || t.nombre || "");
    setInfoUbicacion((prev) => prev || t.ubicacion || "");
    setInfoFecha((prev) => prev || t.fecha || "");
    setInfoEncargado((prev) => prev || t.encargado || "");
  }, [id]);

  useEffect(() => {
    if (!authLoading && !session) router.push("/organizador/acceso");
  }, [authLoading, session, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`admin-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${id}` }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [id, load]);

  function normalizarNombre(s) {
    return s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  async function buscarJugadores(texto) {
    setJugadorInput(texto);
    if (texto.trim().length < 2) {
      setSugerencias([]);
      return;
    }
    const { data } = await supabase.rpc("buscar_jugadores", { q: texto.trim() });
    setSugerencias(data || []);
  }
  function agregarChip(jugador) {
    const yaEsta = jugadoresChips.some((j) => normalizarNombre(j.name) === normalizarNombre(jugador.name));
    if (!yaEsta) setJugadoresChips((prev) => [...prev, jugador]);
    setJugadorInput("");
    setSugerencias([]);
  }
  function quitarChip(name) {
    setJugadoresChips((prev) => prev.filter((j) => j.name !== name));
  }
  function onJugadorKeyDown(e) {
    if (e.key === "Enter" && jugadorInput.trim()) {
      e.preventDefault();
      agregarChip({ name: jugadorInput.trim() });
    }
  }

  async function ensurePlayerId(name) {
    const norm = normalizarNombre(name);
    const { data: existente } = await supabase.from("players").select("id").eq("name_norm", norm).limit(1);
    if (existente && existente.length > 0) return existente[0].id;
    const { data: creado, error: err } = await supabase
      .from("players")
      .insert({ name: name.trim(), name_norm: norm })
      .select("id")
      .single();
    if (err) return null;
    return creado.id;
  }

  async function addTeam() {
    const name = newName.trim();
    if (!name) return;
    const dup = teams.some((t) => t.name.trim().toLowerCase() === name.toLowerCase());
    if (dup) {
      setError(`Ya hay un equipo anotado como "${name}".`);
      return;
    }
    setError("");
    const { data: nuevoEquipo, error: err } = await supabase
      .from("teams")
      .insert({ tournament_id: id, name, players: "", paid: false })
      .select()
      .single();
    if (err) {
      setError("No se pudo agregar el equipo.");
      return;
    }
    for (const j of jugadoresChips) {
      const playerId = await ensurePlayerId(j.name);
      if (playerId) {
        await supabase.from("team_players").insert({ team_id: nuevoEquipo.id, player_id: playerId });
      }
    }
    setNewName("");
    setJugadoresChips([]);
    setJugadorInput("");
    setSugerencias([]);
    load();
  }
  async function removeTeam(teamId) {
    if (tournament.started) return;
    await supabase.from("teams").delete().eq("id", teamId);
    load();
  }
  async function togglePaid(teamId, paid) {
    await supabase.from("teams").update({ paid }).eq("id", teamId);
    load();
  }
  async function editarJugadores(teamId, players) {
    await supabase.from("teams").update({ players }).eq("id", teamId);
    load();
  }

  async function generarCuadroPrincipal(teamIds) {
    if (tournament.modo === "vidon") {
      return supabase.rpc("generar_bracket_vidon", { p_tournament_id: id, p_team_ids: teamIds });
    }
    return supabase.rpc("generar_bracket", { p_tournament_id: id, p_bracket: "main", p_team_ids: teamIds });
  }

  async function doSorteo() {
    if (teams.length < 3) {
      setError("Necesitás al menos 3 equipos anotados para hacer el sorteo.");
      return;
    }
    setError("");
    const { error: err } = await generarCuadroPrincipal(teams.map((t) => t.id));
    if (err) {
      setError("No se pudo hacer el sorteo. Probá de nuevo.");
      console.error(err);
      return;
    }
    await supabase.from("tournaments").update({ started: true }).eq("id", id);
    load();
  }

  async function armarFaseDeGrupos() {
    if (teams.length < cantidadGrupos * 2) {
      setError(`Hacen falta al menos ${cantidadGrupos * 2} equipos para ${cantidadGrupos} grupos.`);
      return;
    }
    setError("");
    const { error: err } = await supabase.rpc("generar_fase_grupos", {
      p_tournament_id: id,
      p_cantidad_grupos: cantidadGrupos,
    });
    if (err) {
      setError("No se pudo armar la fase de grupos. Probá de nuevo.");
      console.error(err);
      return;
    }
    load();
  }

  async function cerrarFaseDeGrupos() {
    if (
      !window.confirm(
        `¿Cerrar la fase de grupos? Clasifican los primeros ${clasificanPorGrupo} de cada grupo y se arma el cuadro con ellos.`
      )
    )
      return;
    setError("");
    const { error: err } = await supabase.rpc("cerrar_fase_grupos_simple", {
      p_tournament_id: id,
      p_top_n: clasificanPorGrupo,
    });
    if (err) {
      setError("No se pudo cerrar la fase de grupos. Probá de nuevo.");
      console.error(err);
      return;
    }
    load();
  }

  function sorteoSinJugar() {
    if (!tournament?.started) return false;
    const ronda0 = matches.filter((m) => m.bracket === "main" && m.round_index === 0);
    return ronda0.every((m) => m.bye || (!m.winner_id && m.score_a === 0 && m.score_b === 0));
  }

  async function cerrarTorneo() {
    if (!window.confirm("¿Cerrar este torneo? Se marca como terminado, aunque no haya un campeón definido. Podés reabrirlo después si te equivocaste.")) return;
    await supabase.from("tournaments").update({ cerrado: true }).eq("id", id);
    load();
  }

  async function reabrirTorneo() {
    await supabase.from("tournaments").update({ cerrado: false }).eq("id", id);
    load();
  }

  function fasesListasParaResortear() {
    const porRonda = {};
    mainMatches.forEach((m) => {
      porRonda[m.round_index] = porRonda[m.round_index] || [];
      porRonda[m.round_index].push(m);
    });
    return Object.keys(porRonda)
      .map(Number)
      .filter((idx) => {
        if (idx === 0) return false; // la ronda 0 ya tiene su propio botón de "Resortear"
        const ms = porRonda[idx];
        const completa = ms.every((m) => m.team1_id && m.team2_id);
        const sinJugar = ms.every((m) => !m.winner_id && m.score_a === 0 && m.score_b === 0);
        return completa && sinJugar;
      })
      .sort((a, b) => a - b)
      .map((idx) => ({ idx, cantidad: porRonda[idx].length }));
  }

  async function resortearFase(idx) {
    if (!window.confirm(`¿Volver a sortear los cruces de esta fase? Nadie jugó nada todavía ahí, así que es seguro.`)) return;
    setError("");
    const { error: err } = await supabase.rpc("resortear_fase", {
      p_tournament_id: id,
      p_bracket: "main",
      p_round_index: idx,
    });
    if (err) {
      setError("No se pudo resortear esa fase. Probá de nuevo.");
      console.error(err);
      return;
    }
    load();
  }

  async function resortear() {
    if (!window.confirm("¿Volver a sortear? Se descarta el cuadro actual y se arma uno nuevo desde cero.")) return;
    setError("");
    await supabase.from("matches").delete().eq("tournament_id", id).eq("bracket", "main");
    await supabase.from("matches").delete().eq("tournament_id", id).eq("bracket", "repechaje");
    await supabase.from("tournaments").update({ champion_id: null, repechaje_champion_id: null }).eq("id", id);
    const { error: err } = await generarCuadroPrincipal(teams.map((t) => t.id));
    if (err) {
      setError("No se pudo resortear. Probá de nuevo.");
      console.error(err);
      return;
    }
    load();
  }

  async function quitarEquipoDelTorneo(teamId) {
    const nombre = teamsById[teamId]?.name || "este equipo";
    if (!window.confirm(`¿Sacar a "${nombre}" del torneo? Se rearma el cuadro con los que queden.`)) return;
    setError("");
    const restantes = teams.filter((t) => t.id !== teamId).map((t) => t.id);
    if (restantes.length < 3) {
      setError("No se puede sacar: quedarían menos de 3 equipos.");
      return;
    }
    await supabase.from("matches").delete().eq("tournament_id", id).eq("bracket", "main");
    await supabase.from("matches").delete().eq("tournament_id", id).eq("bracket", "repechaje");
    await supabase.from("tournaments").update({ champion_id: null, repechaje_champion_id: null }).eq("id", id);
    await supabase.from("teams").delete().eq("id", teamId);
    const { error: err } = await generarCuadroPrincipal(restantes);
    if (err) {
      setError("No se pudo sacar al equipo. Probá de nuevo.");
      console.error(err);
      return;
    }
    load();
  }

  async function agregarEquipoAlTorneo(nombre) {
    const limpio = nombre.trim();
    if (!limpio) return;
    setError("");
    const { data: nuevo, error: errInsert } = await supabase
      .from("teams")
      .insert({ tournament_id: id, name: limpio, players: "", paid: false })
      .select()
      .single();
    if (errInsert) {
      setError("No se pudo agregar el equipo. Probá de nuevo.");
      console.error(errInsert);
      return;
    }
    await supabase.from("matches").delete().eq("tournament_id", id).eq("bracket", "main");
    await supabase.from("matches").delete().eq("tournament_id", id).eq("bracket", "repechaje");
    await supabase.from("tournaments").update({ champion_id: null, repechaje_champion_id: null }).eq("id", id);
    const todos = [...teams.map((t) => t.id), nuevo.id];
    const { error: err } = await generarCuadroPrincipal(todos);
    if (err) {
      setError("No se pudo rearmar el cuadro con el equipo nuevo. Probá de nuevo.");
      console.error(err);
      return;
    }
    setNombreNuevoEquipo("");
    load();
  }

  async function guardarInfo() {
    if (!infoNombre.trim() || !infoUbicacion.trim()) {
      setError("El nombre y la ubicación son obligatorios.");
      return;
    }
    setError("");
    await supabase
      .from("tournaments")
      .update({
        nombre: infoNombre.trim(),
        ubicacion: infoUbicacion.trim(),
        fecha: infoFecha.trim(),
        encargado: infoEncargado.trim() || null,
      })
      .eq("id", id);
    setEditandoInfo(false);
    load();
  }

  async function reabrirPartido(match) {
    const hermanos = matches.filter((m) => m.bracket === match.bracket);
    const maxRound = Math.max(...hermanos.map((m) => m.round_index));
    const afecta = match.round_index < maxRound;
    const mensaje = afecta
      ? "¿Reabrir este partido? Como su resultado ya se usó para jugar partidos más adelante, esos también se deshacen automáticamente, en cascada, hasta el final del cuadro."
      : "¿Reabrir este partido? El resultado actual se borra y vuelve a estar 'por jugar'.";
    if (!window.confirm(mensaje)) return;

    const { error: err } = await supabase.rpc("reabrir_cascada", { p_match_id: match.id });
    if (err) {
      setError("No se pudo reabrir el partido. Probá de nuevo.");
      console.error(err);
      return;
    }
    load();
  }

  async function forzarGanador(match, winnerId) {
    const nombreEquipo = teamsById[winnerId]?.name || "este equipo";
    if (!window.confirm(`¿Marcar a "${nombreEquipo}" como ganador de este partido?`)) return;
    await supabase.rpc("declarar_ganador", { p_match_id: match.id, p_winner_id: winnerId });
    load();
  }

  function repechajeSinJugar() {
    if (!repMatches.length) return true;
    return repMatches.every((m) => !m.winner_id && m.score_a === 0 && m.score_b === 0);
  }

  async function quitarDeRepechaje(teamIdAQuitar) {
    const nombre = teamsById[teamIdAQuitar]?.name || "este equipo";
    if (!window.confirm(`¿Sacar a "${nombre}" del repechaje? Se rearma el cuadro con los que queden.`)) return;

    const participantes = new Set();
    repMatches.forEach((m) => {
      if (m.team1_id) participantes.add(m.team1_id);
      if (m.team2_id) participantes.add(m.team2_id);
    });
    participantes.delete(teamIdAQuitar);
    const restantes = [...participantes];

    await supabase.from("matches").delete().eq("tournament_id", id).eq("bracket", "repechaje");

    if (restantes.length >= 2) {
      await supabase.rpc("generar_bracket", { p_tournament_id: id, p_bracket: "repechaje", p_team_ids: restantes });
      await supabase.from("tournaments").update({ repechaje_champion_id: null }).eq("id", id);
    } else if (restantes.length === 1) {
      await supabase.from("tournaments").update({ repechaje_champion_id: restantes[0] }).eq("id", id);
    } else {
      await supabase.from("tournaments").update({ repechaje_champion_id: null }).eq("id", id);
    }
    load();
  }

  async function simularTorneoCompleto() {
    if (!window.confirm("Esto va a completar TODO el torneo con resultados al azar (para testear). ¿Seguro?")) return;
    setSimulando(true);
    for (let i = 0; i < 200; i++) {
      const { data: pend } = await supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", id)
        .is("winner_id", null)
        .not("team1_id", "is", null)
        .not("team2_id", "is", null);
      if (!pend || pend.length === 0) break;
      const m = pend[0];
      const winnerId = Math.random() < 0.5 ? m.team1_id : m.team2_id;
      await supabase.rpc("declarar_ganador", { p_match_id: m.id, p_winner_id: winnerId });
    }
    setSimulando(false);
    load();
  }

  async function eliminarTorneoPrueba() {
    if (!window.confirm("¿Eliminar este torneo de prueba? Se borra junto con sus equipos y partidos, no se puede deshacer.")) return;
    await supabase.from("tournaments").delete().eq("id", id);
    router.push("/organizador/panel");
  }

  const esDueño = session && tournament && (tournament.organizador_id === session.user.id || profile?.role === "admin");

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.ink }}>
        Cargando…
      </div>
    );
  }
  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6" style={{ background: T.bg, color: T.ink }}>
        No encontramos este torneo.
      </div>
    );
  }
  if (!esDueño) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center text-center px-6 gap-3"
        style={{ background: T.bg, color: T.ink }}
      >
        <p>Este torneo no es tuyo, así que no lo podés administrar.</p>
        <Link href={`/torneo/${id}`} className="underline font-bold" style={{ color: T.goldBright }}>
          Ver el cuadro en vivo (solo lectura)
        </Link>
      </div>
    );
  }

  const teamsById = {};
  teams.forEach((t) => (teamsById[t.id] = t));
  const mainMatches = matches.filter((m) => m.bracket === "main");
  const repMatches = matches.filter((m) => m.bracket === "repechaje");
  const publicUrl = `${origin}/torneo/${id}`;
  const enFaseDeGrupos = tournament.formato === "grupos" && tournament.grupos_generados;

  function rondaActualIndex() {
    const porRonda = {};
    mainMatches.forEach((m) => {
      porRonda[m.round_index] = porRonda[m.round_index] || [];
      porRonda[m.round_index].push(m);
    });
    const indices = Object.keys(porRonda).map(Number).sort((a, b) => a - b);
    for (const idx of indices) {
      const todosListos = porRonda[idx].every((m) => m.bye || m.winner_id);
      if (!todosListos) return idx;
    }
    return indices[indices.length - 1] ?? 0; // torneo ya terminado: la última
  }

  function crucesPendientes() {
    // Un cruce está pendiente de avisar si: es un partido nuevo recién
    // definido (avisado=false), o si es un "espera rival" recién armado
    // (avisado_espera=false). Cuando a un "espera rival" ya avisado le
    // aparece el rival, vuelve a contar como pendiente (avisado sigue
    // en false hasta que se avise ESE cruce ya completo).
    // Importante: solo mira la fase ACTUAL — la que sigue no se avisa
    // hasta que la actual termine del todo.
    const idx = rondaActualIndex();
    const pendientes = mainMatches.filter((m) => {
      if (m.round_index !== idx) return false;
      if (!m.team1_id) return false; // nada para avisar todavía
      if (m.bye || m.team2_id) return !m.avisado; // cruce definido (o libre)
      return !m.avisado_espera; // solo espera rival
    });
    return pendientes.sort((a, b) => a.match_index - b.match_index);
  }

  function textoCrucesPendientes() {
    const numeroPorEquipo = {};
    teams.forEach((t, i) => (numeroPorEquipo[t.id] = i + 1));
    const conNumero = (teamId) => {
      const nombre = teamsById[teamId]?.name || "?";
      const num = numeroPorEquipo[teamId];
      return num ? `${num} (${nombre})` : nombre;
    };
    const pendientes = crucesPendientes();
    const porRonda = {};
    pendientes.forEach((m) => {
      porRonda[m.round_index] = porRonda[m.round_index] || [];
      porRonda[m.round_index].push(m);
    });
    const bloques = Object.keys(porRonda)
      .map(Number)
      .sort((a, b) => a - b)
      .map((idx) => {
        const totalRonda = mainMatches.filter((m) => m.round_index === idx).length;
        const nombreRonda = roundLabel(totalRonda);
        const lineas = porRonda[idx].map((m) => {
          const n1 = conNumero(m.team1_id);
          if (m.bye) return `${n1} → LIBRE`;
          if (!m.team2_id) return `${n1} → espera rival`;
          const n2 = conNumero(m.team2_id);
          return `${n1} vs ${n2}`;
        });
        return `📋 ${nombreRonda}\n${lineas.join("\n")}`;
      });
    const fecha = tournament.fecha ? ` — ${tournament.fecha}` : "";
    const texto = `⚔️ ${tournament.nombre}${fecha}\n\n${bloques.join("\n\n")}\n\n${publicUrl}`;
    return { texto, matches: pendientes };
  }

  async function marcarAvisados(matches) {
    const idsDefinidos = matches.filter((m) => m.bye || m.team2_id).map((m) => m.id);
    const idsEspera = matches.filter((m) => !m.bye && !m.team2_id).map((m) => m.id);
    if (idsDefinidos.length > 0) await supabase.from("matches").update({ avisado: true }).in("id", idsDefinidos);
    if (idsEspera.length > 0) await supabase.from("matches").update({ avisado_espera: true }).in("id", idsEspera);
    load();
  }

  async function compartirCruces() {
    const { texto, matches } = textoCrucesPendientes();
    if (matches.length === 0) {
      alert("No hay cruces nuevos todavía.");
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ text: texto });
      } catch (e) {
        return; // canceló, no marcamos nada como avisado
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
    }
    await marcarAvisados(matches);
  }

  function textoResumenActual() {
    const numeroPorEquipo = {};
    teams.forEach((t, i) => (numeroPorEquipo[t.id] = i + 1));
    const conNumero = (teamId) => {
      const nombre = teamsById[teamId]?.name || "?";
      const num = numeroPorEquipo[teamId];
      return num ? `${num} (${nombre})` : nombre;
    };
    const idx = rondaActualIndex();
    const rondaMatches = mainMatches.filter((m) => m.round_index === idx).sort((a, b) => a.match_index - b.match_index);
    const nombreRonda = roundLabel(rondaMatches.length);
    const lineas = rondaMatches
      .filter((m) => m.team1_id)
      .map((m) => {
        const n1 = conNumero(m.team1_id);
        if (m.bye) return `${n1} → LIBRE`;
        if (!m.team2_id) return `${n1} → espera rival`;
        const n2 = conNumero(m.team2_id);
        if (m.winner_id) {
          const marcador = ` (${m.score_a}-${m.score_b})`;
          return `${n1} vs ${n2}${marcador} — ganó ${conNumero(m.winner_id)}`;
        }
        return `${n1} vs ${n2}`;
      });
    const fecha = tournament.fecha ? ` — ${tournament.fecha}` : "";
    return `⚔️ ${tournament.nombre}${fecha}\n📋 ${nombreRonda} (resumen)\n\n${lineas.join("\n")}\n\n${publicUrl}`;
  }

  async function copiarCruces() {
    const { texto, matches } = textoCrucesPendientes();
    const aCopiar = matches.length > 0 ? texto : textoResumenActual();
    try {
      await navigator.clipboard.writeText(aCopiar);
    } catch (e) {
      alert("No se pudo copiar. Probá el botón de compartir.");
      return;
    }
    await marcarAvisados(matches);
  }

  return (
    <div className="transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-3xl lg:max-w-[92vw] xl:max-w-[1500px] mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <Link
            href="/organizador/panel"
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: T.panel, border: `1px solid ${T.line}` }}
          >
            <IconAtras color={T.ink} />
          </Link>
          <ThemeToggleButton />
        </div>
        <h1 className="text-2xl font-black text-center" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
          {tournament.nombre || "Torneo sin nombre"} · Panel del organizador
          {tournament.cerrado && !tournament.champion_id && (
            <span className="block text-xs font-bold mt-1" style={{ color: T.redDim }}>
              Cerrado sin campeón
            </span>
          )}
        </h1>
        <p className="text-center text-xs mb-3" style={{ color: T.inkDim }}>
          {[tournament.ubicacion, tournament.fecha, tournament.categoria].filter(Boolean).join(" · ")}
          {tournament.encargado && <> · Organiza: {tournament.encargado}</>}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
          <button
            onClick={() => setEditandoInfo((v) => !v)}
            className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: T.panelLight, color: T.inkDim }}
          >
            Editar datos
          </button>
          {!tournament.champion_id &&
            (tournament.cerrado ? (
              <button
                onClick={reabrirTorneo}
                className="text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ background: T.panelLight, color: T.goldBright }}
              >
                ↺ Reabrir torneo
              </button>
            ) : (
              <button
                onClick={cerrarTorneo}
                className="text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ background: T.panelLight, color: T.inkDim }}
              >
                Finalizar torneo
              </button>
            ))}
        </div>

        {editandoInfo && (
          <div
            className="rounded-2xl p-4 mb-4 border shadow-sm lg:max-w-md lg:mx-auto"
            style={{ background: T.panel, borderColor: T.line }}
          >
            <div className="flex flex-col gap-2">
              <input
                value={infoNombre}
                onChange={(e) => setInfoNombre(e.target.value)}
                placeholder="Nombre del torneo*"
                className="px-3 py-2 rounded-xl text-sm"
                style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
              />
              <input
                value={infoUbicacion}
                onChange={(e) => setInfoUbicacion(e.target.value)}
                placeholder="Ubicación*"
                className="px-3 py-2 rounded-xl text-sm"
                style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
              />
              <input
                value={infoFecha}
                onChange={(e) => setInfoFecha(e.target.value)}
                placeholder="Fecha"
                className="px-3 py-2 rounded-xl text-sm"
                style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
              />
              <input
                value={infoEncargado}
                onChange={(e) => setInfoEncargado(e.target.value)}
                placeholder="¿Quién organiza? (opcional)"
                className="px-3 py-2 rounded-xl text-sm"
                style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
              />
              <div className="flex gap-2 mt-1">
                <button
                  onClick={guardarInfo}
                  className="flex-1 py-2 rounded-xl font-bold text-sm"
                  style={{ background: T.gold, color: T.ink }}
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditandoInfo(false)}
                  className="flex-1 py-2 rounded-xl font-bold text-sm"
                  style={{ background: T.panelLight, color: T.ink }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
        {origin && (
          <div className="text-center mb-5">
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm font-bold px-4 py-2 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`, color: T.ink }}
            >
              Seguí el torneo en vivo acá
            </a>
          </div>
        )}

        {tournament.champion_id && (
          <div
            className="rounded-3xl p-5 mb-5 text-center border-2 shadow-md"
            style={{ background: "#FBF3E3", borderColor: "#EAC27A" }}
          >
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#B85C55" }}>
              🏆 Campeón
            </div>
            <div className="text-2xl font-black mt-1" style={{ color: "#33453E" }}>
              {teamsById[tournament.champion_id]?.name}
            </div>
            {teamsById[tournament.champion_id]?.players && (
              <div className="text-sm mt-0.5" style={{ color: "#33453E" }}>
                {teamsById[tournament.champion_id].players}
              </div>
            )}
            <div className="text-xs mt-1 italic" style={{ color: "#B85C55" }}>
              {fraseCampeonAlAzar()}
            </div>
          </div>
        )}

        {enFaseDeGrupos ? (
          <FaseDeGruposPanel
            T={T}
            tournament={tournament}
            teams={teams}
            matches={matches}
            teamsById={teamsById}
            onForzarGanador={forzarGanador}
            clasificanPorGrupo={clasificanPorGrupo}
            setClasificanPorGrupo={setClasificanPorGrupo}
            onCerrarFase={cerrarFaseDeGrupos}
            error={error}
            origin={origin}
            onRecargar={load}
          />
        ) : !tournament.started ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 lg:items-start gap-4 mb-4 lg:max-w-4xl lg:mx-auto">
              <div className="rounded-2xl p-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
                <h2 className="font-bold mb-3" style={{ color: T.gold }}>
                  Anotar equipo
                </h2>
                <div className="flex flex-col gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTeam();
                      }
                    }}
                    placeholder={tournament.categoria === "1v1" ? "Nombre del jugador" : "Nombre del equipo"}
                    className="px-3 py-2 rounded-xl text-sm"
                    style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                  />

                  {tournament.categoria !== "1v1" && (
                    <>
                      {jugadoresChips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {jugadoresChips.map((j) => (
                            <span
                              key={j.name}
                              className="text-xs px-2 py-1 rounded-full font-semibold flex items-center gap-1"
                              style={{ background: T.panelLight, color: T.ink }}
                            >
                              {j.name}
                              <button onClick={() => quitarChip(j.name)} style={{ color: T.redDim }}>
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="relative">
                        <input
                          value={jugadorInput}
                          onChange={(e) => buscarJugadores(e.target.value)}
                          onKeyDown={onJugadorKeyDown}
                          placeholder="Agregar jugador"
                          className="w-full px-3 py-2 rounded-xl text-sm"
                          style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                        />
                        {sugerencias.length > 0 && (
                          <div
                            className="absolute z-10 w-full mt-1 rounded-xl border shadow-md overflow-hidden"
                            style={{ background: T.panel, borderColor: T.line }}
                          >
                            {sugerencias.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => agregarChip(s)}
                                className="w-full text-left px-3 py-2 text-sm"
                                style={{ color: T.ink }}
                              >
                                {s.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <button
                    onClick={addTeam}
                    className="py-2 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{ background: T.gold, color: T.ink }}
                  >
                    + Agregar equipo
                  </button>
                </div>
              </div>

              {teams.length > 0 && (
                <div className="rounded-2xl p-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
                  <button
                    onClick={() => setMostrarEquipos((v) => !v)}
                    className="w-full flex items-center justify-between font-bold"
                    style={{ color: T.gold }}
                  >
                    <span>Equipos anotados ({teams.length})</span>
                    <span className="text-xs" style={{ color: T.inkDim }}>
                      {mostrarEquipos ? "Ocultar ▲" : "Mostrar ▼"}
                    </span>
                  </button>
                  {mostrarEquipos && (
                    <div className="mt-3">
                      <p className="text-xs mb-2" style={{ color: T.inkDim }}>
                        🔑 = el código de ese equipo. Dáselo cuando se anoten — lo van a necesitar para anotar
                        puntos en sus partidos.
                      </p>
                      <input
                        value={busquedaEquipos}
                        onChange={(e) => setBusquedaEquipos(e.target.value)}
                        placeholder="Buscar equipo..."
                        className="w-full px-3 py-2 rounded-xl text-sm mb-3"
                        style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                      />
                      <TeamList
                        teams={teams.filter((t) => t.name.toLowerCase().includes(busquedaEquipos.toLowerCase()))}
                        editable
                        onTogglePaid={togglePaid}
                        onRemove={removeTeam}
                        onEditPlayers={editarJugadores}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="lg:max-w-md lg:mx-auto">
              {error && (
                <p className="text-sm text-center mb-3" style={{ color: T.goldBright }}>
                  {error}
                </p>
              )}

              <div className="flex rounded-xl overflow-hidden p-0.5 mb-3" style={{ background: T.panelLight }}>
                <button
                  onClick={() => setFormatoElegido("directa")}
                  className="flex-1 py-2 text-xs font-bold rounded-lg"
                  style={{
                    background: formatoElegido === "directa" ? T.gold : "transparent",
                    color: formatoElegido === "directa" ? T.ink : T.inkDim,
                  }}
                >
                  Cuadro directo
                </button>
                <button
                  onClick={() => setFormatoElegido("grupos")}
                  className="flex-1 py-2 text-xs font-bold rounded-lg"
                  style={{
                    background: formatoElegido === "grupos" ? T.gold : "transparent",
                    color: formatoElegido === "grupos" ? T.ink : T.inkDim,
                  }}
                >
                  Fase de grupos
                </button>
              </div>

              {formatoElegido === "directa" ? (
                <button
                  onClick={doSorteo}
                  disabled={teams.length < 3}
                  className="w-full py-3 rounded-2xl font-black text-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                  style={{
                    background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`,
                    color: T.ink,
                    boxShadow: `0 6px 16px ${T.gold}44`,
                  }}
                >
                  ⚔️ Hacer los cruces
                </button>
              ) : (
                <div className="rounded-2xl p-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
                  <label className="text-xs font-bold block mb-1.5" style={{ color: T.inkDim }}>
                    ¿Cuántos grupos?
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={cantidadGrupos}
                    onChange={(e) => setCantidadGrupos(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 rounded-xl text-sm mb-3"
                    style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                  />
                  <button
                    onClick={armarFaseDeGrupos}
                    disabled={teams.length < cantidadGrupos * 2}
                    className="w-full py-3 rounded-2xl font-black text-sm transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                    style={{ background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`, color: T.ink }}
                  >
                    Armar fase de grupos →
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl p-4 mb-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
              <button
                onClick={() => setMostrarEquipos((v) => !v)}
                className="w-full flex items-center justify-between font-bold"
                style={{ color: T.gold }}
              >
                <span>Equipos ({teams.length})</span>
                <span className="text-xs" style={{ color: T.inkDim }}>
                  {mostrarEquipos ? "Ocultar ▲" : "Mostrar ▼"}
                </span>
              </button>
              {mostrarEquipos && (
                <div className="mt-3">
                  <input
                    value={busquedaEquipos}
                    onChange={(e) => setBusquedaEquipos(e.target.value)}
                    placeholder="Buscar equipo (para darle su código)..."
                    className="w-full px-3 py-2 rounded-xl text-sm mb-3"
                    style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                  />
                  <TeamList
                    teams={teams.filter((t) => t.name.toLowerCase().includes(busquedaEquipos.toLowerCase()))}
                    editable
                    onTogglePaid={togglePaid}
                    onEditPlayers={editarJugadores}
                    twoColumns
                  />
                </div>
              )}
            </div>

            {(() => {
              const hayPendientes = crucesPendientes().length > 0;
              return (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={compartirCruces}
                    className="flex-1 py-2.5 rounded-2xl font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{ background: hayPendientes ? "#81C784" : T.panelLight, color: hayPendientes ? "#1F2937" : T.inkDim }}
                  >
                    📲 {hayPendientes ? "Compartir cruces" : "Sin cruces nuevos"}
                  </button>
                  <button
                    onClick={copiarCruces}
                    className="px-4 py-2.5 rounded-2xl font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                  >
                    📋 Copiar
                  </button>
                </div>
              );
            })()}

            {fasesListasParaResortear().map(({ idx, cantidad }) => (
              <button
                key={idx}
                onClick={() => resortearFase(idx)}
                className="w-full py-2 rounded-2xl font-bold text-xs mb-3 transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.gold}` }}
              >
                Resortear {roundLabel(cantidad)} (todavía no se jugó nada ahí)
              </button>
            ))}

            {sorteoSinJugar() && (
              <button
                onClick={resortear}
                className="w-full py-2 rounded-2xl font-bold text-xs mb-3 transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.gold}` }}
              >
                Resortear (todavía no se jugó nada)
              </button>
            )}

            {sorteoSinJugar() && (
              <div className="rounded-2xl p-4 mb-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
                <button
                  onClick={() => setMostrarQuitarEquipo((v) => !v)}
                  className="w-full flex items-center justify-between"
                  style={{ color: T.gold }}
                >
                  <span className="font-bold text-sm">Ajustar equipos antes de sortear</span>
                  <span className="text-xs" style={{ color: T.inkDim }}>
                    {mostrarQuitarEquipo ? "Ocultar ▲" : "Mostrar ▼"}
                  </span>
                </button>
                {mostrarQuitarEquipo && (
                  <>
                    <p className="text-xs mb-2 mt-2" style={{ color: T.inkDim }}>
                      ¿Se anotó tarde un equipo más? Agregalo acá — el cuadro se rearma con todos.
                    </p>
                    <div className="flex gap-2 mb-4">
                      <input
                        value={nombreNuevoEquipo}
                        onChange={(e) => setNombreNuevoEquipo(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            agregarEquipoAlTorneo(nombreNuevoEquipo);
                          }
                        }}
                        placeholder="Nombre del equipo nuevo"
                        className="flex-1 px-3 py-2 rounded-xl text-sm"
                        style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                      />
                      <button
                        onClick={() => agregarEquipoAlTorneo(nombreNuevoEquipo)}
                        className="px-4 py-2 rounded-xl font-bold text-sm"
                        style={{ background: T.gold, color: T.ink }}
                      >
                        + Agregar
                      </button>
                    </div>

                    <p className="text-xs mb-2" style={{ color: T.inkDim }}>
                      ¿Perdió un desempate, se bajó, etc.? Sacalo — el cuadro se rearma solo con los que queden.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {teams.map((t) => (
                        <span
                          key={t.id}
                          className="text-xs pl-3 pr-1.5 py-1.5 rounded-full font-semibold flex items-center gap-1.5"
                          style={{ background: T.panelLight, color: T.ink }}
                        >
                          {t.name}
                          <button
                            onClick={() => quitarEquipoDelTorneo(t.id)}
                            className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: T.redDim, color: "#FFFFFF" }}
                            title="Sacar del torneo"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {tournament.es_prueba && !tournament.champion_id && (
              <button
                onClick={simularTorneoCompleto}
                disabled={simulando}
                className="w-full py-2 rounded-2xl font-bold text-xs mb-3 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60"
                style={{ background: T.panelLight, color: T.redDim, border: `1px solid ${T.line}` }}
              >
                {simulando ? "Simulando…" : "Simular resultados al azar (solo para test)"}
              </button>
            )}

            {tournament.es_prueba && (
              <button
                onClick={eliminarTorneoPrueba}
                className="w-full py-2 rounded-2xl font-bold text-xs mb-3 transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ background: "transparent", color: T.redDim, border: `1px solid ${T.redDim}` }}
              >
                Eliminar torneo de prueba
              </button>
            )}

            <div className="flex rounded-xl p-0.5 gap-0.5 mb-4" style={{ background: T.panelLight }}>
              <button
                onClick={() => setVista("mesas")}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors duration-200"
                style={{ background: vista === "mesas" ? T.gold : "transparent", color: vista === "mesas" ? T.ink : T.inkDim }}
              >
                Mesas
              </button>
              <button
                onClick={() => setVista("cuadro")}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors duration-200"
                style={{ background: vista === "cuadro" ? T.gold : "transparent", color: vista === "cuadro" ? T.ink : T.inkDim }}
              >
                Cuadro completo
              </button>
            </div>

            {vista === "mesas" ? (
              <MesasPendientes
                matches={[...mainMatches, ...repMatches]}
                teamsById={teamsById}
                origin={origin}
                onDeclareWinner={forzarGanador}
              />
            ) : (
              <>
                <h2 className="font-bold mb-3" style={{ color: T.gold }}>
                  Cuadro principal — tocá un equipo para forzar el resultado
                </h2>
                <div className="mb-2">
                  <BracketDisplayAdmin
                    matches={mainMatches}
                    teamsById={teamsById}
                    origin={origin}
                    onDeclareWinner={forzarGanador}
                    onReabrir={reabrirPartido}
                  />
                </div>

                {tournament.repechaje && repMatches.length > 0 && (
                  <div className="mt-6">
                    <h2 className="font-bold mb-3" style={{ color: T.gold }}>
                      Cuadro de repechaje
                    </h2>

                    {repechajeSinJugar() && (
                      <div className="rounded-2xl p-4 mb-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
                        <p className="text-xs mb-2" style={{ color: T.inkDim }}>
                          ¿Alguno no va a pagar de nuevo para el repechaje? Sacalo de la lista — el cuadro se
                          rearma solo con los que queden.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {[...new Set(repMatches.flatMap((m) => [m.team1_id, m.team2_id]).filter(Boolean))].map(
                            (tid) => (
                              <span
                                key={tid}
                                className="text-xs pl-3 pr-1.5 py-1.5 rounded-full font-semibold flex items-center gap-1.5"
                                style={{ background: T.panelLight, color: T.ink }}
                              >
                                {teamsById[tid]?.name}
                                <button
                                  onClick={() => quitarDeRepechaje(tid)}
                                  className="w-5 h-5 rounded-full flex items-center justify-center"
                                  style={{ background: T.redDim, color: "#FFFFFF" }}
                                  title="Sacar del repechaje"
                                >
                                  ✕
                                </button>
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    <BracketDisplayAdmin
                      matches={repMatches}
                      teamsById={teamsById}
                      origin={origin}
                      onDeclareWinner={forzarGanador}
                      onReabrir={reabrirPartido}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Fase de grupos — versión simple (v1): mientras se juegan los grupos,
// muestra tabla + fixture de cada uno; una vez armadas las copas con los
// clasificados, muestra ese cuadro en una lista lisa por ronda (todavía
// no el gráfico de BracketDisplayAdmin — eso queda para la versión
// completa, más adelante).
// El toggle abierto/cerrado lo maneja el padre (FaseDeGruposPanel), para
// poder mostrar "Abrir anotador" y "Cargar resultado a mano" lado a lado
// cuando está cerrado, y que el formulario ocupe todo el ancho al abrirse
// en vez de quedar apretado contra el link de al lado.
function ResultadoInlineGrupo({ T, match, nombreLocal, nombreVisitante, onCancelar, onGuardado }) {
  const [local, setLocal] = useState("");
  const [visitante, setVisitante] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const pa = parseInt(local, 10);
    const pb = parseInt(visitante, 10);
    if (isNaN(pa) || isNaN(pb)) {
      setError("Cargá los dos puntajes.");
      return;
    }
    if (pa === pb) {
      setError("No puede haber empate.");
      return;
    }
    setError("");
    setGuardando(true);
    const { error: err } = await supabase.rpc("cargar_resultado_grupo", {
      p_match_id: match.id,
      p_score_a: pa,
      p_score_b: pb,
    });
    setGuardando(false);
    if (err) {
      setError("No se pudo guardar. Revisá el tope de puntos de esta fase.");
      return;
    }
    onGuardado();
  }

  return (
    <div className="mt-2 w-full">
      <div className="flex items-center gap-1.5">
        <span className="text-xs flex-1 min-w-0 truncate" style={{ color: T.inkDim }}>
          {nombreLocal}
        </span>
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value.replace(/\D/g, "").slice(0, 2))}
          inputMode="numeric"
          placeholder="0"
          className="w-14 flex-shrink-0 text-center px-1 py-2 rounded-lg text-sm"
          style={{ background: T.panel, color: T.ink, border: `1px solid ${T.line}` }}
        />
        <span className="text-xs flex-shrink-0" style={{ color: T.inkDim }}>
          -
        </span>
        <input
          value={visitante}
          onChange={(e) => setVisitante(e.target.value.replace(/\D/g, "").slice(0, 2))}
          inputMode="numeric"
          placeholder="0"
          className="w-14 flex-shrink-0 text-center px-1 py-2 rounded-lg text-sm"
          style={{ background: T.panel, color: T.ink, border: `1px solid ${T.line}` }}
        />
        <span className="text-xs flex-1 min-w-0 truncate text-right" style={{ color: T.inkDim }}>
          {nombreVisitante}
        </span>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={guardar}
          disabled={guardando}
          className="flex-1 text-xs font-bold py-2 rounded-lg disabled:opacity-60"
          style={{ background: T.gold, color: T.ink }}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={onCancelar} className="text-xs px-3 py-2" style={{ color: T.inkDim }}>
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

function FaseDeGruposPanel({
  T,
  tournament,
  teams,
  matches,
  teamsById,
  onForzarGanador,
  clasificanPorGrupo,
  setClasificanPorGrupo,
  onCerrarFase,
  error,
  origin,
  onRecargar,
}) {
  const grupoMatches = matches.filter((m) => m.bracket === "grupos");
  const numerosGrupos = [...new Set(teams.map((t) => t.grupo).filter((g) => g != null))].sort((a, b) => a - b);
  const grupoTodosJugados = grupoMatches.length > 0 && grupoMatches.every((m) => m.winner_id);
  const [gruposAbiertos, setGruposAbiertos] = useState({});

  function grupoAbierto(num) {
    return gruposAbiertos[num] !== false; // abierto por default
  }
  function toggleGrupo(num) {
    setGruposAbiertos((prev) => ({ ...prev, [num]: !grupoAbierto(num) }));
  }

  async function compartirCrucesGrupo(numGrupo, partidosGrupo) {
    const pendientes = partidosGrupo.filter((m) => !m.winner_id);
    if (pendientes.length === 0) return;
    const bloques = pendientes.map((m) => {
      const link = `${origin}/partido/${m.match_token}`;
      return `${teamsById[m.team1_id]?.name} vs ${teamsById[m.team2_id]?.name}\n${link}`;
    });
    const texto = `${tournament.nombre} — Grupo ${numGrupo}\n\n${bloques.join("\n\n")}`;
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

  const [formResultadoId, setFormResultadoId] = useState(null);

  function tablaDeGrupo(numGrupo) {
    const stats = {};
    teams
      .filter((t) => t.grupo === numGrupo)
      .forEach((t) => {
        stats[t.id] = { team: t, pj: 0, pg: 0, pf: 0, pc: 0 };
      });
    grupoMatches
      .filter((m) => m.grupo === numGrupo && m.winner_id)
      .forEach((m) => {
        if (stats[m.team1_id]) {
          stats[m.team1_id].pj++;
          stats[m.team1_id].pf += m.score_a;
          stats[m.team1_id].pc += m.score_b;
          if (m.winner_id === m.team1_id) stats[m.team1_id].pg++;
        }
        if (stats[m.team2_id]) {
          stats[m.team2_id].pj++;
          stats[m.team2_id].pf += m.score_b;
          stats[m.team2_id].pc += m.score_a;
          if (m.winner_id === m.team2_id) stats[m.team2_id].pg++;
        }
      });
    return Object.values(stats).sort((a, b) => b.pg - a.pg || b.pf - b.pc - (a.pf - a.pc));
  }

  if (tournament.copas_generadas) {
    const oro = matches.filter((m) => m.bracket === "oro");
    const plata = matches.filter((m) => m.bracket === "plata");
    return (
      <div>
        <div className="rounded-2xl p-4 mb-4 border shadow-sm text-center" style={{ background: T.panel, borderColor: T.line }}>
          <p className="text-sm font-bold" style={{ color: T.gold }}>
            Fase de grupos cerrada — cuadro armado con los clasificados.
          </p>
        </div>
        <CuadroSimple T={T} titulo="Cuadro" matches={oro} teamsById={teamsById} onForzarGanador={onForzarGanador} campeonId={tournament.campeon_oro_id} />
        {plata.length > 0 && (
          <CuadroSimple T={T} titulo="Copa de Plata" matches={plata} teamsById={teamsById} onForzarGanador={onForzarGanador} campeonId={tournament.campeon_plata_id} />
        )}
      </div>
    );
  }

  return (
    <div>
      {numerosGrupos.map((num) => {
        const tabla = tablaDeGrupo(num);
        const partidosGrupo = grupoMatches
          .filter((m) => m.grupo === num)
          .sort((a, b) => a.round_index - b.round_index || a.match_index - b.match_index);
        const abierto = grupoAbierto(num);
        const pendientesGrupo = partidosGrupo.filter((m) => !m.winner_id);
        return (
          <div key={num} className="rounded-2xl p-4 mb-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
            <button onClick={() => toggleGrupo(num)} className="w-full flex items-center justify-between mb-3">
              <h3 className="font-bold" style={{ color: T.gold }}>
                Grupo {num}
              </h3>
              <span style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                <IconAbajo color={T.inkDim} />
              </span>
            </button>

            {abierto && (
              <>
                <div className="rounded-xl border overflow-hidden mb-3" style={{ borderColor: T.line }}>
                  <div
                    className="grid gap-1 px-2 py-1.5 text-[10px] font-extrabold uppercase"
                    style={{ gridTemplateColumns: "1fr 34px 24px 24px 30px", background: T.panelLight, color: T.inkDim }}
                  >
                    <div>Equipo</div>
                    <div className="text-center">Código</div>
                    <div className="text-center">PJ</div>
                    <div className="text-center">PG</div>
                    <div className="text-center">DIF</div>
                  </div>
                  {tabla.map((row) => (
                    <div
                      key={row.team.id}
                      className="grid gap-1 px-2 py-1.5 text-xs items-center"
                      style={{ gridTemplateColumns: "1fr 34px 24px 24px 30px", borderTop: `1px solid ${T.line}`, color: T.ink }}
                    >
                      <div className="truncate font-semibold">{row.team.name}</div>
                      <div className="text-center" style={{ color: T.inkDim }}>
                        {row.team.codigo}
                      </div>
                      <div className="text-center">{row.pj}</div>
                      <div className="text-center">{row.pg}</div>
                      <div className="text-center">{row.pf - row.pc}</div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color: T.inkDim }}>
                    Cruces
                  </span>
                  {pendientesGrupo.length > 0 && (
                    <button
                      onClick={() => compartirCrucesGrupo(num, partidosGrupo)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg"
                      style={{ background: "#81C784", color: "#1B3A2A" }}
                    >
                      Compartir
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  {partidosGrupo.map((m) => (
                    <div key={m.id} className="text-xs px-2.5 py-2.5 rounded-lg" style={{ background: T.panelLight }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <span className="truncate" style={{ color: T.ink }}>
                            {teamsById[m.team1_id]?.name}
                          </span>
                          <b className="flex-shrink-0" style={{ color: T.inkDim, fontSize: 10 }}>
                            vs
                          </b>
                          <span className="truncate" style={{ color: T.ink }}>
                            {teamsById[m.team2_id]?.name}
                          </span>
                        </div>
                        {m.winner_id && (
                          <span className="font-bold flex-shrink-0" style={{ color: T.goldBright }}>
                            {m.score_a}-{m.score_b}
                          </span>
                        )}
                      </div>
                      {!m.winner_id &&
                        (formResultadoId === m.id ? (
                          <ResultadoInlineGrupo
                            T={T}
                            match={m}
                            nombreLocal={teamsById[m.team1_id]?.name}
                            nombreVisitante={teamsById[m.team2_id]?.name}
                            onCancelar={() => setFormResultadoId(null)}
                            onGuardado={() => {
                              setFormResultadoId(null);
                              onRecargar();
                            }}
                          />
                        ) : (
                          <div className="flex gap-1.5 mt-2">
                            <a
                              href={`/partido/${m.match_token}`}
                              className="flex-1 text-center font-bold py-2 rounded-lg"
                              style={{ background: T.panel, color: T.goldBright, border: `1px solid ${T.line}` }}
                            >
                              Abrir anotador
                            </a>
                            <button
                              onClick={() => setFormResultadoId(m.id)}
                              className="flex-1 text-center font-bold py-2 rounded-lg"
                              style={{ background: "transparent", color: T.inkDim, border: `1px solid ${T.line}` }}
                            >
                              Cargar a mano
                            </button>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}

      {error && (
        <p className="text-sm text-center mb-3" style={{ color: T.goldBright }}>
          {error}
        </p>
      )}

      {grupoTodosJugados ? (
        <div className="rounded-2xl p-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
          <p className="text-sm mb-3" style={{ color: T.ink }}>
            Todos los partidos de grupos están jugados. ¿Cuántos clasifican de cada grupo?
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={clasificanPorGrupo}
              onChange={(e) => setClasificanPorGrupo(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-20 px-3 py-2 rounded-xl text-sm text-center"
              style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
            />
            <button
              onClick={onCerrarFase}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`, color: T.ink }}
            >
              Cerrar fase de grupos y armar cuadro
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-center" style={{ color: T.inkDim }}>
          Faltan partidos de grupos por jugar.
        </p>
      )}
    </div>
  );
}

function CuadroSimple({ T, titulo, matches, teamsById, onForzarGanador, campeonId }) {
  const porRonda = {};
  matches.forEach((m) => {
    porRonda[m.round_index] = porRonda[m.round_index] || [];
    porRonda[m.round_index].push(m);
  });
  const rondas = Object.keys(porRonda)
    .map(Number)
    .sort((a, b) => a - b);
  return (
    <div className="rounded-2xl p-4 mb-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
      <h3 className="font-bold mb-3" style={{ color: T.gold }}>
        {titulo}
      </h3>
      {campeonId && (
        <p className="text-sm font-bold text-center mb-3" style={{ color: T.goldBright }}>
          🏆 Campeón: {teamsById[campeonId]?.name}
        </p>
      )}
      {rondas.map((idx) => (
        <div key={idx} className="mb-3">
          <div className="text-xs font-extrabold uppercase mb-1.5" style={{ color: T.inkDim }}>
            Ronda {idx + 1}
          </div>
          <div className="flex flex-col gap-1.5">
            {porRonda[idx]
              .sort((a, b) => a.match_index - b.match_index)
              .map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg gap-2"
                  style={{ background: T.panelLight }}
                >
                  <span style={{ color: T.ink }}>
                    {m.team1_id ? teamsById[m.team1_id]?.name : "—"} <b style={{ color: T.inkDim }}>vs</b>{" "}
                    {m.team2_id ? teamsById[m.team2_id]?.name : "—"}
                  </span>
                  {m.winner_id ? (
                    <span className="font-bold flex-shrink-0" style={{ color: T.goldBright }}>
                      {m.score_a}-{m.score_b}
                    </span>
                  ) : m.team1_id && m.team2_id ? (
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => onForzarGanador(m, m.team1_id)}
                        className="px-2 py-1 rounded-lg font-bold"
                        style={{ background: T.panel, color: T.goldBright, border: `1px solid ${T.line}` }}
                      >
                        Ganó {teamsById[m.team1_id]?.name}
                      </button>
                      <button
                        onClick={() => onForzarGanador(m, m.team2_id)}
                        className="px-2 py-1 rounded-lg font-bold"
                        style={{ background: T.panel, color: T.goldBright, border: `1px solid ${T.line}` }}
                      >
                        Ganó {teamsById[m.team2_id]?.name}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] flex-shrink-0" style={{ color: T.inkDim }}>
                      esperando rival
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Vista rápida: una tarjeta por mesa pendiente, con acceso directo al
// anotador, sin tener que scrollear todo el cuadro para llegar hasta ahí.
function MesasPendientes({ matches, teamsById, origin, onDeclareWinner }) {
  const { T } = useTheme();
  const [abiertoPendientes, setAbiertoPendientes] = useState(true);
  const [abiertoJugados, setAbiertoJugados] = useState(false);
  const pendientes = matches.filter((m) => !m.bye && m.team1_id && m.team2_id && !m.winner_id && m.match_token);
  const jugados = matches.filter((m) => !m.bye && m.team1_id && m.team2_id && m.winner_id);

  if (pendientes.length === 0 && jugados.length === 0) {
    return (
      <p className="text-sm text-center" style={{ color: T.inkDim }}>
        Todavía no hay partidos con los dos equipos definidos.
      </p>
    );
  }

  return (
    <div>
      {pendientes.length > 0 && (
        <>
          <button
            onClick={() => setAbiertoPendientes((v) => !v)}
            className="w-full flex items-center justify-between mb-3"
          >
            <h2 className="font-bold text-sm" style={{ color: T.gold }}>
              Por jugar ({pendientes.length})
            </h2>
            <span className="text-xs" style={{ color: T.gold }}>
              {abiertoPendientes ? "▲" : "▼"}
            </span>
          </button>
          {abiertoPendientes && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {pendientes.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border p-3 shadow-sm flex flex-col gap-2"
                  style={{ background: T.panel, borderColor: T.line }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onDeclareWinner(m, m.team1_id)}
                      className="text-sm font-semibold text-right px-2 py-1.5 rounded-lg transition-colors duration-150 flex-1 truncate"
                      style={{ color: T.ink }}
                    >
                      {teamsById[m.team1_id]?.name}
                    </button>
                    <span className="text-xs flex-shrink-0" style={{ color: T.inkDim }}>
                      vs
                    </span>
                    <button
                      onClick={() => onDeclareWinner(m, m.team2_id)}
                      className="text-sm font-semibold text-left px-2 py-1.5 rounded-lg transition-colors duration-150 flex-1 truncate"
                      style={{ color: T.ink }}
                    >
                      {teamsById[m.team2_id]?.name}
                    </button>
                  </div>
                  <a
                    href={`${origin}/partido/${m.match_token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 py-2 rounded-xl font-bold text-sm text-center transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{
                      background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`,
                      color: T.ink,
                    }}
                  >
                    Abrir anotador →
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {jugados.length > 0 && (
        <>
          <button
            onClick={() => setAbiertoJugados((v) => !v)}
            className="w-full flex items-center justify-between mb-3"
          >
            <h2 className="font-bold text-sm" style={{ color: T.gold }}>
              Ya jugados ({jugados.length})
            </h2>
            <span className="text-xs" style={{ color: T.gold }}>
              {abiertoJugados ? "▲" : "▼"}
            </span>
          </button>
          {abiertoJugados && (
          <div className="flex flex-col gap-1.5">
            {jugados.map((m) => (
              <div
                key={m.id}
                className="px-3 py-2 rounded-xl text-sm"
                style={{ background: T.panelLight, color: T.inkDim }}
              >
                <span style={{ color: m.winner_id === m.team1_id ? T.goldBright : T.inkDim }}>
                  {teamsById[m.team1_id]?.name}
                </span>
                {" vs "}
                <span style={{ color: m.winner_id === m.team2_id ? T.goldBright : T.inkDim }}>
                  {teamsById[m.team2_id]?.name}
                </span>
              </div>
            ))}
          </div>
          )}
        </>
      )}
    </div>
  );
}

// Envuelve BracketDisplay agregando, debajo del cuadro, la lista de
// tanteadores ya jugados con botón para reabrirlos — lo único que
// BracketDisplay no trae de fábrica. El link directo a cada mesa por
// jugar ya lo muestra BracketDisplay solo (adminMode + tournamentUrl).
function BracketDisplayAdmin({ matches, teamsById, origin, onDeclareWinner, onReabrir }) {
  const { T } = useTheme();
  const [abiertoFinalizados, setAbiertoFinalizados] = useState(false);
  const finalizados = matches.filter((m) => !m.bye && m.team1_id && m.team2_id && m.winner_id && m.match_token);

  return (
    <div>
      <BracketDisplay
        matches={matches}
        teamsById={teamsById}
        adminMode
        tournamentUrl={origin}
        onDeclareWinner={onDeclareWinner}
      />

      {finalizados.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setAbiertoFinalizados((v) => !v)}
            className="w-full flex items-center justify-between mb-2"
          >
            <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: T.inkDim }}>
              Tanteadores partidos finalizados ({finalizados.length})
            </h3>
            <span className="text-xs" style={{ color: T.inkDim }}>
              {abiertoFinalizados ? "▲" : "▼"}
            </span>
          </button>
          {abiertoFinalizados && (
            <div className="flex flex-col gap-2">
              {finalizados.map((m) => (
                <div
                  key={m.id}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-3"
                  style={{ background: T.panelLight, border: `1px solid ${T.line}`, opacity: 0.85 }}
                >
                  <span className="flex-1 truncate">
                    <span style={{ color: m.winner_id === m.team1_id ? T.goldBright : T.inkDim }}>
                      {teamsById[m.team1_id]?.name} ({m.score_a ?? 0})
                    </span>
                    <span style={{ color: T.inkDim }}> vs </span>
                    <span style={{ color: m.winner_id === m.team2_id ? T.goldBright : T.inkDim }}>
                      {teamsById[m.team2_id]?.name} ({m.score_b ?? 0})
                    </span>
                  </span>
                  <button
                    onClick={() => onReabrir(m)}
                    className="text-xs font-bold flex-shrink-0 px-2 py-1 rounded-full"
                    style={{ color: T.redDim, border: `1px solid ${T.redDim}` }}
                    title="Reabrir este partido"
                  >
                    ↺ reabrir
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
