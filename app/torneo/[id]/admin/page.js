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
import { IconAtras, IconAbajo, IconPuntos, IconCopiar, IconWhatsApp } from "../../../../components/LineIcons";
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
  const [simulandoGrupos, setSimulandoGrupos] = useState(false);
  const [mostrarEquipos, setMostrarEquipos] = useState(false);
  const [busquedaEquipos, setBusquedaEquipos] = useState("");
  const [busquedaAjustarEquipos, setBusquedaAjustarEquipos] = useState("");
  const [mostrarQuitarEquipo, setMostrarQuitarEquipo] = useState(false);
  const [linkInscripcionCopiado, setLinkInscripcionCopiado] = useState(false);
  const [editandoJugadoresDe, setEditandoJugadoresDe] = useState(null); // team id, o null
  const [jugadoresEditando, setJugadoresEditando] = useState([]); // [{id, name, dni, telefono, fecha_nacimiento, email}]
  const [guardandoJugadores, setGuardandoJugadores] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [sorteoAjustesAbierto, setSorteoAjustesAbierto] = useState(false);
  const [formatoResorteo, setFormatoResorteo] = useState(null); // null = todavía no lo tocó, usa el formato actual del torneo
  const [modoPruebaAbierto, setModoPruebaAbierto] = useState(false);
  const [nombreNuevoEquipo, setNombreNuevoEquipo] = useState("");
  const [formatoElegido, setFormatoElegido] = useState("directa"); // "directa" | "grupos" | "clasificatoria"
  const [cantidadGrupos, setCantidadGrupos] = useState(4);
  const [perdedoresElegidos, setPerdedoresElegidos] = useState(new Set());
  const [cerrandoClasificatoria, setCerrandoClasificatoria] = useState(false);
  const [clasificanPorGrupo, setClasificanPorGrupo] = useState(2);
  const [oroHasta, setOroHasta] = useState(2); // de los que clasifican, cuántos van a la Copa de Oro (el resto, a Plata)

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
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `tournament_id=eq.${id}` }, load)
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
    // Pareja tardía mientras la clasificatoria está en juego: se anota
    // igual que cualquier equipo, y esto la mete en un cruce que esté
    // esperando rival (o le arma uno nuevo) — no se resortea nada.
    if (tournament.formato === "clasificatoria" && tournament.clasificatoria_generada && !tournament.clasificatoria_cerrada) {
      await supabase.rpc("agregar_tardio_clasificatoria", { p_tournament_id: id, p_team_id: nuevoEquipo.id });
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
  async function setMetodoPago(teamId, metodo) {
    await supabase.from("teams").update({ metodo_pago: metodo, paid: !!metodo }).eq("id", teamId);
    load();
  }
  async function editarJugadores(teamId, players) {
    await supabase.from("teams").update({ players }).eq("id", teamId);
    load();
  }

  async function editarNombreEquipo(teamId, name) {
    const limpio = name.trim();
    if (!limpio) return;
    await supabase.from("teams").update({ name: limpio }).eq("id", teamId);
    load();
  }

  async function generarCuadroPrincipal(teamIds, modoOverride) {
    const modo = modoOverride || tournament.modo;
    if (modo === "vidon") {
      return supabase.rpc("generar_bracket_vidon", { p_tournament_id: id, p_team_ids: teamIds });
    }
    return supabase.rpc("generar_bracket", { p_tournament_id: id, p_bracket: "main", p_team_ids: teamIds });
  }

  async function doSorteo() {
    if (teamsAprobados.length < 3) {
      setError("Necesitás al menos 3 equipos anotados para hacer el sorteo.");
      return;
    }
    setError("");
    const { error: err } = await generarCuadroPrincipal(teamsAprobados.map((t) => t.id));
    if (err) {
      setError("No se pudo hacer el sorteo. Probá de nuevo.");
      console.error(err);
      return;
    }
    await supabase.from("tournaments").update({ started: true }).eq("id", id);
    load();
  }

  async function armarFaseDeGrupos() {
    if (teamsAprobados.length < cantidadGrupos * 2) {
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
    const oroHastaFinal = Math.min(oroHasta, clasificanPorGrupo);
    const hayPlata = oroHastaFinal < clasificanPorGrupo;
    const mensaje = hayPlata
      ? `¿Cerrar la fase de grupos? Clasifican los primeros ${clasificanPorGrupo} de cada grupo: del 1° al ${oroHastaFinal}° van a la Copa de Oro, y del ${oroHastaFinal + 1}° al ${clasificanPorGrupo}° van a la Copa de Plata.`
      : `¿Cerrar la fase de grupos? Clasifican los primeros ${clasificanPorGrupo} de cada grupo y se arma el cuadro con ellos.`;
    if (!window.confirm(mensaje)) return;
    setError("");
    const { error: err } = await supabase.rpc("cerrar_fase_grupos_simple", {
      p_tournament_id: id,
      p_top_n: clasificanPorGrupo,
      p_oro_hasta: oroHastaFinal,
    });
    if (err) {
      setError("No se pudo cerrar la fase de grupos. Probá de nuevo.");
      console.error(err);
      return;
    }
    load();
  }

  function esPotenciaDeDos(n) {
    return n > 0 && (n & (n - 1)) === 0;
  }

  async function generarClasificatoria() {
    if (teamsAprobados.length < 3) {
      setError("Necesitás al menos 3 equipos anotados para armar la clasificatoria.");
      return;
    }
    setError("");
    const { error: err } = await supabase.rpc("generar_clasificatoria", { p_tournament_id: id });
    if (err) {
      setError(err.message || "No se pudo armar la clasificatoria. Probá de nuevo.");
      console.error(err);
      return;
    }
    load();
  }

  function toggleLoserElegido(teamId) {
    setPerdedoresElegidos((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  function sortearPerdedoresClasificatoria(cupo, disponibles) {
    const barajados = [...disponibles].sort(() => Math.random() - 0.5);
    setPerdedoresElegidos(new Set(barajados.slice(0, cupo)));
  }

  async function cerrarClasificatoria() {
    setCerrandoClasificatoria(true);
    const { error: err } = await supabase.rpc("cerrar_clasificatoria", {
      p_tournament_id: id,
      p_perdedores_elegidos: Array.from(perdedoresElegidos),
    });
    setCerrandoClasificatoria(false);
    if (err) {
      setError(err.message || "No se pudo cerrar la clasificatoria. Probá de nuevo.");
      console.error(err);
      return;
    }
    setPerdedoresElegidos(new Set());
    load();
  }

  function textoClasificatoria(clasifMatches) {
    const numeroPorEquipo = {};
    teams.forEach((t, i) => (numeroPorEquipo[t.id] = i + 1));
    const conNumero = (teamId) => {
      const nombre = teamsById[teamId]?.name || "?";
      const num = numeroPorEquipo[teamId];
      return num ? `${num} (${nombre})` : nombre;
    };
    const ordenados = [...clasifMatches].sort((a, b) => a.match_index - b.match_index);
    const lineas = ordenados.map((m) => {
      const n1 = conNumero(m.team1_id);
      if (!m.team2_id) return `${n1} → espera rival`;
      const n2 = conNumero(m.team2_id);
      return `${n1} vs ${n2}`;
    });
    const fecha = tournament.fecha ? ` — ${tournament.fecha}` : "";
    return `⚔️ ${tournament.nombre}${fecha}\n\n📋 Clasificatoria\n${lineas.join("\n")}\n\n${publicUrl}`;
  }

  async function compartirCrucesClasificatoria(clasifMatches) {
    if (clasifMatches.length === 0) return;
    const texto = textoClasificatoria(clasifMatches);
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

  async function copiarCrucesClasificatoria(clasifMatches) {
    if (clasifMatches.length === 0) return;
    const texto = textoClasificatoria(clasifMatches);
    try {
      await navigator.clipboard.writeText(texto);
    } catch (e) {
      alert("No se pudo copiar. Probá el botón de compartir.");
    }
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
    const modoElegido = formatoResorteo ?? tournament.modo;
    const cambiaFormato = modoElegido !== tournament.modo;
    const nombreFormato = modoElegido === "vidon" ? "Sistema Vidón Bar" : "Eliminación directa";
    const mensaje = cambiaFormato
      ? `¿Cambiar el formato a "${nombreFormato}" y volver a sortear? Se descarta el cuadro actual y se arma uno nuevo desde cero.`
      : "¿Volver a sortear? Se descarta el cuadro actual y se arma uno nuevo desde cero.";
    if (!window.confirm(mensaje)) return;
    setError("");
    await supabase.from("matches").delete().eq("tournament_id", id).eq("bracket", "main");
    await supabase.from("matches").delete().eq("tournament_id", id).eq("bracket", "repechaje");
    await supabase
      .from("tournaments")
      .update({
        champion_id: null,
        repechaje_champion_id: null,
        modo: modoElegido,
        repechaje: modoElegido === "vidon" ? false : tournament.repechaje,
      })
      .eq("id", id);
    const { error: err } = await generarCuadroPrincipal(teamsAprobados.map((t) => t.id), modoElegido);
    if (err) {
      setError("No se pudo resortear. Probá de nuevo.");
      console.error(err);
      return;
    }
    setFormatoResorteo(null);
    load();
  }

  // Volver de "fase de grupos" o "clasificatoria" a "cuadro directo" sin
  // tener que crear un torneo nuevo — solo tiene sentido mientras nadie
  // jugó nada todavía en esa fase (si no, se perdería el resultado real).
  async function volverACuadroDirecto(bracketAEliminar) {
    const nombre = bracketAEliminar === "grupos" ? "la fase de grupos" : "la clasificatoria";
    if (!window.confirm(`¿Volver a "Cuadro directo"? Se borra ${nombre} armada (nadie jugó nada todavía ahí, es seguro) y podés elegir el formato de nuevo.`))
      return;
    setError("");
    await supabase.from("matches").delete().eq("tournament_id", id).eq("bracket", bracketAEliminar);
    const updates = { formato: "directa" };
    if (bracketAEliminar === "grupos") updates.grupos_generados = false;
    if (bracketAEliminar === "clasificatoria") {
      updates.clasificatoria_generada = false;
      updates.clasificatoria_cerrada = false;
    }
    const { error: err } = await supabase.from("tournaments").update(updates).eq("id", id);
    if (err) {
      setError("No se pudo volver a cuadro directo. Probá de nuevo.");
      console.error(err);
      return;
    }
    setFormatoElegido("directa");
    load();
  }

  async function quitarEquipoDelTorneo(teamId) {
    const nombre = teamsById[teamId]?.name || "este equipo";
    if (!window.confirm(`¿Sacar a "${nombre}" del torneo? Se rearma el cuadro con los que queden.`)) return;
    setError("");
    const restantes = teamsAprobados.filter((t) => t.id !== teamId).map((t) => t.id);
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
    const todos = [...teamsAprobados.map((t) => t.id), nuevo.id];
    const { error: err } = await generarCuadroPrincipal(todos);
    if (err) {
      setError("No se pudo rearmar el cuadro con el equipo nuevo. Probá de nuevo.");
      console.error(err);
      return;
    }
    setNombreNuevoEquipo("");
    load();
  }

  async function copiarLinkInscripcion() {
    try {
      await navigator.clipboard.writeText(anotarmeUrl);
      setLinkInscripcionCopiado(true);
      setTimeout(() => setLinkInscripcionCopiado(false), 2000);
    } catch (e) {
      alert("No se pudo copiar el link.");
    }
  }

  async function aprobarEquipo(teamId) {
    await supabase.from("teams").update({ pendiente_aprobacion: false }).eq("id", teamId);
    load();
  }

  async function rechazarEquipo(teamId) {
    const nombre = teamsById[teamId]?.name || "este equipo";
    if (!window.confirm(`¿Rechazar la inscripción de "${nombre}"? No se puede deshacer.`)) return;
    await supabase.from("teams").delete().eq("id", teamId);
    load();
  }

  // Editor de jugadores autoinscriptos: a diferencia de editarJugadores()
  // (que solo pisa el texto libre teams.players), este edita los campos
  // estructurados de cada jugador en la tabla players — Nombre, DNI,
  // Teléfono, Fecha de Nacimiento, Mail.
  async function abrirEditorJugadores(teamId) {
    const { data } = await supabase
      .from("team_players")
      .select("players(id, name, dni, telefono, fecha_nacimiento, email)")
      .eq("team_id", teamId);
    setJugadoresEditando((data || []).map((row) => row.players).filter(Boolean));
    setEditandoJugadoresDe(teamId);
  }

  function actualizarJugadorEditando(playerId, campo, valor) {
    setJugadoresEditando((prev) => prev.map((j) => (j.id === playerId ? { ...j, [campo]: valor } : j)));
  }

  async function guardarJugadoresEditados() {
    setGuardandoJugadores(true);
    for (const j of jugadoresEditando) {
      await supabase
        .from("players")
        .update({
          name: j.name?.trim() || null,
          dni: j.dni?.trim() || null,
          telefono: j.telefono?.trim() || null,
          fecha_nacimiento: j.fecha_nacimiento || null,
          email: j.email?.trim() || null,
        })
        .eq("id", j.id);
    }
    setGuardandoJugadores(false);
    setEditandoJugadoresDe(null);
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

  async function asignarCasilleroVidon(matchId, teamId) {
    const { error: err } = await supabase.rpc("asignar_equipo_casillero_vidon", {
      p_match_id: matchId,
      p_team_id: teamId,
    });
    if (err) {
      setError("No se pudo asignar el equipo a ese casillero. Probá de nuevo.");
      console.error(err);
      return;
    }
    load();
  }

  async function quitarDeCasilleroVidon(matchId, teamId) {
    const nombre = teamsById[teamId]?.name || "este equipo";
    if (!window.confirm(`¿Sacar a "${nombre}" de este casillero? El equipo no se borra del torneo, solo queda libre para reasignarlo.`)) return;
    const { error: err } = await supabase.rpc("quitar_de_casillero_vidon", {
      p_match_id: matchId,
      p_team_id: teamId,
    });
    if (err) {
      setError("No se pudo sacar el equipo de ese casillero. Probá de nuevo.");
      console.error(err);
      return;
    }
    load();
  }

  async function saltarCasilleroVidon(matchId) {
    if (
      !window.confirm(
        "¿Saltar este casillero? Ya no va a esperar ningún reingreso — el partido de la próxima ronda pasa directo con lo que ya tenga."
      )
    )
      return;
    const { error: err } = await supabase.rpc("saltar_casillero_vidon", { p_match_id: matchId });
    if (err) {
      setError("No se pudo saltar el casillero. Probá de nuevo.");
      console.error(err);
      return;
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
        .neq("bracket", "grupos") // los de grupos necesitan puntaje real, los simula aparte
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

  async function simularFaseDeGrupos() {
    if (!window.confirm("Esto completa TODOS los partidos pendientes de la fase de grupos con resultados al azar (para testear). ¿Seguro?")) return;
    setSimulandoGrupos(true);
    const tope = tournament.puntos_max || 30;
    const pendientes = matches.filter((m) => m.bracket === "grupos" && !m.winner_id && m.team1_id && m.team2_id);
    for (const m of pendientes) {
      const ganaA = Math.random() < 0.5;
      const perdedor = Math.floor(Math.random() * tope); // 0..tope-1
      await supabase.rpc("cargar_resultado_grupo", {
        p_match_id: m.id,
        p_score_a: ganaA ? tope : perdedor,
        p_score_b: ganaA ? perdedor : tope,
      });
    }
    setSimulandoGrupos(false);
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
  // ?jugar=1 habilita elegir equipo en la página pública — así el link
  // que comparte el organizador funciona distinto de entrar navegando
  // desde /en-vivo (ahí solo se puede mirar, no elegir equipo).
  const publicUrl = `${origin}/torneo/${id}?jugar=1`;
  const anotarmeUrl = `${origin}/torneo/${id}/anotarme`;
  const esAdmin = profile?.role === "admin";

  // Equipos que se autoinscribieron (sin login) todavía no cuentan para
  // nada — el organizador los tiene que aprobar primero.
  const teamsAprobados = teams.filter((t) => !t.pendiente_aprobacion);
  const teamsPendientes = teams.filter((t) => t.pendiente_aprobacion);

  // Modo Vidón: casilleros de la primera ronda todavía sin jugar (donde se
  // puede reingresar un equipo eliminado) y qué equipos están libres para
  // ocuparlos — perdieron algún partido y no están ya anotados en otro
  // partido pendiente.
  const modoVidon = tournament.modo === "vidon";
  const casillerosVidonSinJugar = mainMatches.filter((m) => m.round_index === 0 && !m.winner_id && !m.bye);
  const casillerosVidonLibres = casillerosVidonSinJugar.filter((m) => !m.team1_id || !m.team2_id);
  const equiposActivos = new Set();
  matches.forEach((m) => {
    if (!m.winner_id) {
      if (m.team1_id) equiposActivos.add(m.team1_id);
      if (m.team2_id) equiposActivos.add(m.team2_id);
    }
  });
  const equiposEliminados = new Set();
  matches.forEach((m) => {
    if (m.winner_id) {
      const perdedorId = m.winner_id === m.team1_id ? m.team2_id : m.team1_id;
      if (perdedorId) equiposEliminados.add(perdedorId);
    }
  });
  const equiposLibresVidon = teams.filter((t) => equiposEliminados.has(t.id) && !equiposActivos.has(t.id));
  const enFaseDeGrupos = tournament.formato === "grupos" && tournament.grupos_generados;
  const enClasificatoria =
    tournament.formato === "clasificatoria" && tournament.clasificatoria_generada && !tournament.clasificatoria_cerrada;
  const clasifMatches = matches.filter((m) => m.bracket === "clasificatoria");

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

  const badgeCerrado = tournament.cerrado && !tournament.champion_id;
  const infoLinea = [tournament.ubicacion, tournament.fecha, tournament.categoria].filter(Boolean).join(" · ");

  const kebab = tournament.es_prueba && (
    <div className="relative">
      <button
        onClick={() => setMenuAbierto((v) => !v)}
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: T.panel, border: `1px solid ${T.line}` }}
        title="Más opciones"
      >
        <IconPuntos color={T.ink} />
      </button>
      {menuAbierto && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-2xl border shadow-lg z-30 p-1.5"
          style={{ background: T.panel, borderColor: T.line }}
        >
          <button
            onClick={() => {
              setMenuAbierto(false);
              setModoPruebaAbierto((v) => !v);
            }}
            className="w-full text-left px-3 py-2.5 text-sm font-semibold rounded-xl"
            style={{ color: T.inkDim }}
          >
            Herramientas de prueba
          </button>
        </div>
      )}
    </div>
  );

  const editarDatosBtn = (
    <button
      onClick={() => setEditandoInfo((v) => !v)}
      className="h-10 px-4 text-xs font-bold rounded-full flex-shrink-0 whitespace-nowrap"
      style={{ background: "transparent", border: `1px solid ${T.line}`, color: T.ink }}
    >
      Editar datos
    </button>
  );
  const reabrirFinalizarBtn = !tournament.champion_id && (
    <button
      onClick={tournament.cerrado ? reabrirTorneo : cerrarTorneo}
      className="h-10 px-4 text-xs font-bold rounded-full flex-shrink-0 whitespace-nowrap flex items-center gap-1.5"
      style={{ background: "transparent", border: `1px solid ${T.line}`, color: T.ink }}
    >
      {tournament.cerrado ? "↺ Reabrir torneo" : "Finalizar torneo"}
    </button>
  );

  return (
    <div className="transition-colors duration-500" style={{ background: T.bg }}>
      <div className="w-full max-w-[430px] lg:max-w-none mx-auto px-4 lg:px-9 py-[18px] lg:py-7">
        {/* ── Header móvil ── */}
        <div className="lg:hidden">
          <div className="flex justify-between items-center mb-5">
            <Link
              href="/organizador/panel"
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: T.panel, border: `1px solid ${T.line}` }}
            >
              <IconAtras color={T.ink} />
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggleButton />
              {kebab}
            </div>
          </div>

          <div className="text-center mb-3.5">
            <h1 className="font-bold text-xl mb-1" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
              {tournament.nombre || "Torneo sin nombre"}
            </h1>
            <div className="text-xs mb-2" style={{ color: T.inkDim }}>
              Panel del organizador
            </div>
            {badgeCerrado && (
              <div
                className="inline-block text-[11px] font-extrabold px-2.5 py-1 rounded-full mb-1.5"
                style={{ background: "rgba(232,163,155,0.12)", color: T.redDim }}
              >
                Cerrado sin campeón
              </div>
            )}
            <div className="text-xs" style={{ color: T.inkDim }}>
              {infoLinea}
              {tournament.encargado && <> · Organiza: {tournament.encargado}</>}
            </div>
          </div>

          <div className="flex justify-center gap-2 mb-4.5">
            {editarDatosBtn}
            {reabrirFinalizarBtn}
          </div>

          {origin && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-center py-4 rounded-2xl font-extrabold text-sm mb-5"
              style={{
                background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`,
                color: T.bg,
                boxShadow: "0 8px 20px rgba(227,181,99,0.2)",
              }}
            >
              Seguí el torneo en vivo acá →
            </a>
          )}
        </div>

        {/* ── Header desktop ── */}
        <div className="hidden lg:flex items-center justify-between mb-7">
          <div className="flex items-center gap-4">
            <Link
              href="/organizador/panel"
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: T.panel, border: `1px solid ${T.line}` }}
            >
              <IconAtras color={T.ink} />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-bold text-2xl" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
                  {tournament.nombre || "Torneo sin nombre"}
                </h1>
                {badgeCerrado && (
                  <div
                    className="text-[11px] font-extrabold px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(232,163,155,0.12)", color: T.redDim }}
                  >
                    Cerrado sin campeón
                  </div>
                )}
              </div>
              <div className="text-[13px] mt-1" style={{ color: T.inkDim }}>
                {infoLinea} · Panel del organizador
                {tournament.encargado && <> · Organiza: {tournament.encargado}</>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {editarDatosBtn}
            {reabrirFinalizarBtn}
            <ThemeToggleButton />
            {kebab}
            {origin && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="h-10 px-5 flex items-center rounded-xl font-extrabold text-sm whitespace-nowrap"
                style={{
                  background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`,
                  color: T.bg,
                  boxShadow: "0 6px 16px rgba(227,181,99,0.2)",
                }}
              >
                Seguí el torneo en vivo →
              </a>
            )}
          </div>
        </div>

        {modoPruebaAbierto && tournament.es_prueba && (
          <div
            className="rounded-2xl p-3.5 mb-5"
            style={{ background: "rgba(232,163,155,0.06)", border: "1px dashed #5A3B37" }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-wide mb-2" style={{ color: T.inkDim }}>
              Modo prueba
            </div>
            <div className="flex flex-col gap-2">
              {!tournament.champion_id && (
                <button
                  onClick={simularTorneoCompleto}
                  disabled={simulando}
                  className="text-left text-xs font-semibold disabled:opacity-60"
                  style={{ color: "#C9A46B" }}
                >
                  {simulando ? "Simulando…" : "Simular resultados al azar"}
                </button>
              )}
              <button
                onClick={eliminarTorneoPrueba}
                className="text-left text-xs font-semibold"
                style={{ color: T.redDim }}
              >
                Eliminar torneo de prueba
              </button>
            </div>
          </div>
        )}

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
            oroHasta={oroHasta}
            setOroHasta={setOroHasta}
            onCerrarFase={cerrarFaseDeGrupos}
            error={error}
            origin={origin}
            onRecargar={load}
            onSimular={simularFaseDeGrupos}
            simulando={simulandoGrupos}
            onReabrir={reabrirPartido}
            setMetodoPago={setMetodoPago}
            editarJugadores={editarJugadores}
            editarNombreEquipo={editarNombreEquipo}
            mostrarEquipos={mostrarEquipos}
            setMostrarEquipos={setMostrarEquipos}
            busquedaEquipos={busquedaEquipos}
            setBusquedaEquipos={setBusquedaEquipos}
            onVolver={() => volverACuadroDirecto("grupos")}
          />
        ) : !tournament.started ? (
          <>
            {esAdmin && (
              <div className="rounded-2xl p-4 mb-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
                <h3 className="font-bold text-sm mb-1" style={{ color: T.ink }}>
                  Inscripción sin login
                </h3>
                <p className="text-xs mb-3" style={{ color: T.inkDim }}>
                  Los equipos que se anoten con este link quedan pendientes de tu aprobación — no cuentan para el
                  sorteo hasta que los confirmes acá abajo. Compartilo solo con quien vos quieras.
                </p>
                <button
                  onClick={copiarLinkInscripcion}
                  className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                >
                  <IconCopiar color={T.ink} />
                  {linkInscripcionCopiado ? "¡Copiado!" : "Copiar link de inscripción"}
                </button>
              </div>
            )}

            {esAdmin && teamsPendientes.length > 0 && (
              <div className="rounded-2xl p-4 mb-4 border shadow-sm" style={{ background: T.panel, borderColor: "#B85C55" }}>
                <h3 className="font-bold text-sm mb-3" style={{ color: T.ink }}>
                  Equipos pendientes de aprobar ({teamsPendientes.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {teamsPendientes.map((t) => (
                    <div key={t.id} className="rounded-xl p-3" style={{ background: T.bg, border: `1px solid ${T.line}` }}>
                      <div className="text-sm font-bold" style={{ color: T.ink }}>
                        {t.name}
                      </div>
                      {t.players && (
                        <div className="text-xs mb-2" style={{ color: T.inkDim }}>
                          {t.players}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => aprobarEquipo(t.id)}
                          className="flex-1 py-1.5 rounded-lg font-bold text-xs"
                          style={{ background: T.gold, color: T.ink }}
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => abrirEditorJugadores(t.id)}
                          className="flex-1 py-1.5 rounded-lg font-bold text-xs"
                          style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => rechazarEquipo(t.id)}
                          className="flex-1 py-1.5 rounded-lg font-bold text-xs"
                          style={{ background: T.redDim, color: "#FFFFFF" }}
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {esAdmin && teamsAprobados.length > 0 && (
              <div className="rounded-2xl p-4 mb-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
                <h3 className="font-bold text-sm mb-3" style={{ color: T.ink }}>
                  Corregir datos de jugadores
                </h3>
                <div className="flex flex-wrap gap-2">
                  {teamsAprobados.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => abrirEditorJugadores(t.id)}
                      className="text-xs px-3 py-1.5 rounded-full font-semibold"
                      style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                    >
                      ✎ {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editandoJugadoresDe && (
              <div
                className="fixed inset-0 z-40 flex items-center justify-center p-4"
                style={{ background: "rgba(0,0,0,0.5)" }}
                onClick={() => setEditandoJugadoresDe(null)}
              >
                <div
                  className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl p-4 border shadow-lg"
                  style={{ background: T.panel, borderColor: T.line }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="font-bold text-sm mb-3" style={{ color: T.gold }}>
                    Editar jugadores
                  </h3>
                  {jugadoresEditando.length === 0 ? (
                    <p className="text-sm" style={{ color: T.inkDim }}>
                      Este equipo no tiene jugadores con datos cargados para editar.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {jugadoresEditando.map((j) => (
                        <div key={j.id} className="rounded-xl p-3" style={{ background: T.bg, border: `1px solid ${T.line}` }}>
                          <div className="flex flex-col gap-2">
                            <input
                              value={j.name || ""}
                              onChange={(e) => actualizarJugadorEditando(j.id, "name", e.target.value)}
                              placeholder="Nombre"
                              className="px-3 py-2 rounded-lg text-sm"
                              style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                            />
                            <input
                              value={j.dni || ""}
                              onChange={(e) => actualizarJugadorEditando(j.id, "dni", e.target.value)}
                              placeholder="DNI"
                              className="px-3 py-2 rounded-lg text-sm"
                              style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                            />
                            <input
                              value={j.telefono || ""}
                              onChange={(e) => actualizarJugadorEditando(j.id, "telefono", e.target.value)}
                              placeholder="Teléfono"
                              className="px-3 py-2 rounded-lg text-sm"
                              style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                            />
                            <div>
                              <label className="text-[11px]" style={{ color: T.inkDim }}>
                                Fecha de nacimiento
                              </label>
                              <input
                                value={j.fecha_nacimiento || ""}
                                onChange={(e) => actualizarJugadorEditando(j.id, "fecha_nacimiento", e.target.value)}
                                type="date"
                                className="w-full px-3 py-2 rounded-lg text-sm mt-1"
                                style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                              />
                            </div>
                            <input
                              value={j.email || ""}
                              onChange={(e) => actualizarJugadorEditando(j.id, "email", e.target.value)}
                              placeholder="Mail"
                              type="email"
                              className="px-3 py-2 rounded-lg text-sm"
                              style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setEditandoJugadoresDe(null)}
                      className="flex-1 py-2 rounded-xl font-bold text-sm"
                      style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                    >
                      Cancelar
                    </button>
                    {jugadoresEditando.length > 0 && (
                      <button
                        onClick={guardarJugadoresEditados}
                        disabled={guardandoJugadores}
                        className="flex-1 py-2 rounded-xl font-black text-sm disabled:opacity-50"
                        style={{ background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`, color: T.ink }}
                      >
                        {guardandoJugadores ? "Guardando…" : "Guardar"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 lg:items-start gap-4 mb-4">
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

              {teamsAprobados.length > 0 && (
                <div className="rounded-2xl p-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
                  <button
                    onClick={() => setMostrarEquipos((v) => !v)}
                    className="w-full flex items-center justify-between font-bold"
                    style={{ color: T.gold }}
                  >
                    <span>Equipos anotados ({teamsAprobados.length})</span>
                    <span style={{ transform: mostrarEquipos ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                      <IconAbajo color={T.inkDim} />
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
                        teams={teamsAprobados.filter((t) => t.name.toLowerCase().includes(busquedaEquipos.toLowerCase()))}
                        editable
                        onSetMetodoPago={setMetodoPago}
                        onRemove={removeTeam}
                        onEditPlayers={editarJugadores}
                        onEditName={editarNombreEquipo}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {enClasificatoria ? (
              <ClasificatoriaPanel
                T={T}
                clasifMatches={clasifMatches}
                teamsById={teamsById}
                onForzarGanador={forzarGanador}
                onReabrir={reabrirPartido}
                onCompartir={() => compartirCrucesClasificatoria(clasifMatches)}
                onCopiar={() => copiarCrucesClasificatoria(clasifMatches)}
                perdedoresElegidos={perdedoresElegidos}
                onToggleLoser={toggleLoserElegido}
                onSortearLosers={sortearPerdedoresClasificatoria}
                onCerrar={cerrarClasificatoria}
                cerrando={cerrandoClasificatoria}
                onVolver={() => volverACuadroDirecto("clasificatoria")}
                error={error}
              />
            ) : (
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
                  {esAdmin && modoVidon && !esPotenciaDeDos(teamsAprobados.length) && (
                    <button
                      onClick={() => setFormatoElegido("clasificatoria")}
                      className="flex-1 py-2 text-xs font-bold rounded-lg"
                      style={{
                        background: formatoElegido === "clasificatoria" ? T.gold : "transparent",
                        color: formatoElegido === "clasificatoria" ? T.ink : T.inkDim,
                      }}
                    >
                      Clasificatoria
                    </button>
                  )}
                </div>

                {formatoElegido === "directa" ? (
                  <button
                    onClick={doSorteo}
                    disabled={teamsAprobados.length < 3}
                    className="w-full py-3 rounded-2xl font-black text-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                    style={{
                      background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`,
                      color: T.ink,
                      boxShadow: `0 6px 16px ${T.gold}44`,
                    }}
                  >
                    ⚔️ Hacer los cruces
                  </button>
                ) : formatoElegido === "grupos" ? (
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
                      disabled={teamsAprobados.length < cantidadGrupos * 2}
                      className="w-full py-3 rounded-2xl font-black text-sm transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                      style={{ background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`, color: T.ink }}
                    >
                      Armar fase de grupos →
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl p-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
                    <p className="text-xs mb-3" style={{ color: T.inkDim }}>
                      {teamsAprobados.length} equipos no da un cuadro redondo. Se arma una ronda donde juegan todos, y
                      con los ganadores + los perdedores que elijas después arma un cuadro limpio.
                    </p>
                    <button
                      onClick={generarClasificatoria}
                      disabled={teamsAprobados.length < 3}
                      className="w-full py-3 rounded-2xl font-black text-sm transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                      style={{ background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`, color: T.ink }}
                    >
                      Generar clasificatoria →
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <button
                    onClick={() => {
                      setMostrarEquipos((v) => !v);
                      setSorteoAjustesAbierto(false);
                    }}
                    className="h-11 px-4 rounded-xl font-bold text-sm flex items-center gap-2"
                    style={{ background: T.panel, border: `1px solid ${T.line}`, color: T.ink }}
                  >
                    Equipos ({teamsAprobados.length}) <span className="text-[10px]" style={{ color: T.inkDim }}>▾</span>
                  </button>
                  {mostrarEquipos && (
                    <div
                      className="absolute top-12 left-0 w-[min(90vw,320px)] max-h-[360px] overflow-y-auto rounded-2xl border shadow-lg p-3.5 z-30"
                      style={{ background: T.panel, borderColor: T.line }}
                    >
                      <input
                        value={busquedaEquipos}
                        onChange={(e) => setBusquedaEquipos(e.target.value)}
                        placeholder="Buscar equipo (para darle su código)..."
                        className="w-full px-3 py-2 rounded-xl text-sm mb-3"
                        style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                      />
                      <TeamList
                        teams={teamsAprobados.filter((t) => t.name.toLowerCase().includes(busquedaEquipos.toLowerCase()))}
                        editable
                        onSetMetodoPago={setMetodoPago}
                        onEditPlayers={editarJugadores}
                        onEditName={editarNombreEquipo}
                      />
                    </div>
                  )}
                </div>

                {(() => {
                  const hayPendientes = crucesPendientes().length > 0;
                  return (
                    <div className="flex gap-2">
                      <button
                        onClick={compartirCruces}
                        className="h-11 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all duration-200 hover:scale-105 active:scale-95"
                        style={{ background: hayPendientes ? "#81C784" : T.panelLight, color: hayPendientes ? "#1B3A2A" : T.inkDim }}
                      >
                        {hayPendientes && <IconWhatsApp color="#1B3A2A" />}
                        {hayPendientes ? "Compartir cruces" : "Sin cruces nuevos"}
                      </button>
                      <button
                        onClick={copiarCruces}
                        title="Copiar"
                        className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                        style={{ background: T.panel, color: T.ink, border: `1px solid ${T.line}` }}
                      >
                        <IconCopiar color={T.ink} />
                      </button>
                    </div>
                  );
                })()}

                {(fasesListasParaResortear().length > 0 || sorteoSinJugar()) && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setSorteoAjustesAbierto((v) => !v);
                        setMostrarEquipos(false);
                      }}
                      className="h-11 px-4 rounded-xl font-bold text-sm flex items-center gap-2"
                      style={{ background: T.panel, border: `1px solid ${T.line}`, color: T.ink }}
                    >
                      Sorteo y ajustes <span className="text-[10px]" style={{ color: T.inkDim }}>▾</span>
                    </button>
                    {sorteoAjustesAbierto && (
                      <div
                        className="absolute top-12 left-0 w-[min(90vw,320px)] max-h-[70vh] overflow-y-auto rounded-2xl border shadow-lg p-3.5 z-30"
                        style={{ background: T.panel, borderColor: T.line }}
                      >
                        {fasesListasParaResortear().map(({ idx, cantidad }) => (
                          <button
                            key={idx}
                            onClick={() => resortearFase(idx)}
                            className="w-full py-2 rounded-2xl font-bold text-xs mb-3 transition-all duration-200 hover:scale-105 active:scale-95"
                            style={{ background: "transparent", color: T.goldBright, border: `1px solid ${T.gold}` }}
                          >
                            Resortear {roundLabel(cantidad)} (todavía no se jugó nada ahí)
                          </button>
                        ))}

                        {sorteoSinJugar() && (
                          <div className="rounded-xl p-3 border mb-3" style={{ background: T.bg, borderColor: T.line }}>
                            <span className="text-xs font-bold" style={{ color: T.inkDim }}>
                              Formato
                            </span>
                            <div className="flex rounded-xl overflow-hidden border mt-1.5 mb-2" style={{ borderColor: T.gold }}>
                              <button
                                onClick={() => setFormatoResorteo("directa")}
                                className="flex-1 py-2 text-xs font-bold"
                                style={{
                                  background: (formatoResorteo ?? tournament.modo) === "directa" ? T.gold : "transparent",
                                  color: (formatoResorteo ?? tournament.modo) === "directa" ? T.ink : T.inkDim,
                                }}
                              >
                                Eliminación directa
                              </button>
                              <button
                                onClick={() => setFormatoResorteo("vidon")}
                                className="flex-1 py-2 text-xs font-bold"
                                style={{
                                  background: (formatoResorteo ?? tournament.modo) === "vidon" ? T.gold : "transparent",
                                  color: (formatoResorteo ?? tournament.modo) === "vidon" ? T.ink : T.inkDim,
                                }}
                              >
                                Sistema Vidón Bar
                              </button>
                            </div>
                            <button
                              onClick={resortear}
                              className="w-full py-2 rounded-2xl font-bold text-xs transition-all duration-200 hover:scale-105 active:scale-95"
                              style={{ background: "transparent", color: T.goldBright, border: `1px solid ${T.gold}` }}
                            >
                              {(formatoResorteo ?? tournament.modo) === tournament.modo
                                ? "Resortear (todavía no se jugó nada)"
                                : "Cambiar formato y resortear"}
                            </button>
                          </div>
                        )}

                        {sorteoSinJugar() && (
                          <div className="rounded-xl p-3 border" style={{ background: T.bg, borderColor: T.line }}>
                            <button
                              onClick={() => setMostrarQuitarEquipo((v) => !v)}
                              className="w-full flex items-center justify-between"
                              style={{ color: T.ink }}
                            >
                              <span className="font-bold text-sm">Ajustar equipos antes de sortear</span>
                              <span className="text-xs font-semibold" style={{ color: T.inkDim }}>
                                {mostrarQuitarEquipo ? "Ocultar ›" : "Mostrar ›"}
                              </span>
                            </button>
                            {mostrarQuitarEquipo && (
                              <>
                                <div className="mt-3">
                                  <p className="text-xs mb-2" style={{ color: T.inkDim }}>
                                    ¿Se anotó tarde un equipo más? Agregalo acá — el cuadro se rearma con todos.
                                  </p>
                                  <div className="flex gap-2">
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
                                      className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm"
                                      style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                                    />
                                    <button
                                      onClick={() => agregarEquipoAlTorneo(nombreNuevoEquipo)}
                                      className="flex-shrink-0 px-4 py-2 rounded-xl font-bold text-sm"
                                      style={{ background: T.gold, color: T.ink }}
                                    >
                                      + Agregar
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
                                  <p className="text-xs mb-2" style={{ color: T.inkDim }}>
                                    ¿Perdió un desempate, se bajó, etc.? Sacalo — el cuadro se rearma solo con los que
                                    queden.
                                  </p>
                                  {teamsAprobados.length > 6 && (
                                    <input
                                      value={busquedaAjustarEquipos}
                                      onChange={(e) => setBusquedaAjustarEquipos(e.target.value)}
                                      placeholder="Buscar equipo..."
                                      className="w-full px-3 py-2 rounded-xl text-sm mb-2"
                                      style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                                    />
                                  )}
                                  <div className="flex flex-wrap gap-2">
                                    {teamsAprobados
                                      .filter((t) => t.name.toLowerCase().includes(busquedaAjustarEquipos.toLowerCase()))
                                      .map((t) => (
                                        <span
                                          key={t.id}
                                          className="text-xs pl-3 pr-1.5 py-1.5 rounded-full font-semibold flex items-center gap-1.5"
                                          style={{ background: T.panel, color: T.ink }}
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
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex rounded-xl p-0.5 gap-0.5" style={{ background: T.panelLight }}>
                <button
                  onClick={() => setVista("mesas")}
                  className="flex-1 py-2.5 px-5 rounded-lg text-sm font-bold transition-colors duration-200"
                  style={{ background: vista === "mesas" ? T.gold : "transparent", color: vista === "mesas" ? T.ink : T.inkDim }}
                >
                  Mesas
                </button>
                <button
                  onClick={() => setVista("cuadro")}
                  className="flex-1 py-2.5 px-5 rounded-lg text-sm font-bold transition-colors duration-200"
                  style={{ background: vista === "cuadro" ? T.gold : "transparent", color: vista === "cuadro" ? T.ink : T.inkDim }}
                >
                  Cuadro completo
                </button>
              </div>
            </div>

            {(mostrarEquipos || sorteoAjustesAbierto) && (
              <div
                className="fixed inset-0 z-20"
                onClick={() => {
                  setMostrarEquipos(false);
                  setSorteoAjustesAbierto(false);
                }}
              />
            )}

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

                {modoVidon && equiposLibresVidon.length > 0 && (
                  <p className="text-xs mb-3" style={{ color: T.inkDim }}>
                    Hay equipos eliminados que pueden reingresar — tocá el casillero vacío en el cuadro de abajo
                    para elegir quién entra, o el ✕ junto a un equipo ya colocado para sacarlo y elegir otro.
                  </p>
                )}

                <div className="mb-2">
                  <BracketDisplayAdmin
                    matches={mainMatches}
                    teamsById={teamsById}
                    origin={origin}
                    onDeclareWinner={forzarGanador}
                    onReabrir={reabrirPartido}
                    modoVidon={modoVidon}
                    equiposLibresVidon={equiposLibresVidon}
                    onAsignarCasillero={asignarCasilleroVidon}
                    onQuitarCasillero={quitarDeCasilleroVidon}
                    onSaltarCasillero={saltarCasilleroVidon}
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
          </div>
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
// En truco no existe un resultado tipo "3 a 2": el que gana siempre
// llega al puntaje máximo del torneo. Así que acá solo se elige quién
// ganó, y con cuántos puntos quedó el que perdió.
function ResultadoInlineGrupo({ T, match, nombreLocal, nombreVisitante, puntosMax, onCancelar, onGuardado }) {
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
    if (isNaN(pp) || pp < 0 || pp >= puntosMax) {
      setError(`El que perdió tiene que tener entre 0 y ${puntosMax - 1}.`);
      return;
    }
    setError("");
    setGuardando(true);
    const scoreA = ganador === "A" ? puntosMax : pp;
    const scoreB = ganador === "B" ? puntosMax : pp;
    const { error: err } = await supabase.rpc("cargar_resultado_grupo", {
      p_match_id: match.id,
      p_score_a: scoreA,
      p_score_b: scoreB,
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
      <div className="text-xs mb-1.5" style={{ color: T.inkDim }}>
        ¿Quién ganó? (llega a {puntosMax})
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => setGanador("A")}
          className="flex-1 text-center text-xs font-bold py-2 rounded-lg truncate"
          style={
            ganador === "A"
              ? { background: T.gold, color: T.ink }
              : { background: T.panel, color: T.ink, border: `1px solid ${T.line}` }
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
              : { background: T.panel, color: T.ink, border: `1px solid ${T.line}` }
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
            style={{ background: T.panel, color: T.ink, border: `1px solid ${T.line}` }}
          />
          <span className="text-xs" style={{ color: T.inkDim }}>
            de {puntosMax}
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

// Ronda única "todos contra todos una vez" antes de armar el cuadro
// principal, para cuando la cantidad de equipos no da una potencia de
// 2 en modo Vidón. Mismo anotador de siempre para cada partido; al
// terminar todos, se cierra eligiendo (a mano o por sorteo) qué
// perdedores completan un cuadro limpio.
function ClasificatoriaPanel({
  T,
  clasifMatches,
  teamsById,
  onForzarGanador,
  onReabrir,
  onCompartir,
  onCopiar,
  perdedoresElegidos,
  onToggleLoser,
  onSortearLosers,
  onCerrar,
  cerrando,
  onVolver,
  error,
}) {
  const ordenados = [...clasifMatches].sort((a, b) => a.match_index - b.match_index);
  const pendientes = ordenados.filter((m) => !m.winner_id && m.team1_id && m.team2_id);
  const esperando = ordenados.filter((m) => !m.winner_id && m.team1_id && !m.team2_id);
  const listoParaCerrar = ordenados.length > 0 && pendientes.length === 0;
  const nadieJugoNada = ordenados.every((m) => !m.winner_id);

  const ganadores = ordenados.filter((m) => m.winner_id).map((m) => m.winner_id);
  const ganadoresConEspera = [...ganadores, ...esperando.map((m) => m.team1_id)];
  const perdedoresDisponibles = ordenados
    .filter((m) => m.winner_id)
    .map((m) => (m.winner_id === m.team1_id ? m.team2_id : m.team1_id))
    .filter(Boolean);

  const totalPool = ganadoresConEspera.length + perdedoresDisponibles.length;
  let target = 1;
  while (target * 2 <= totalPool) target *= 2;
  const cupo = Math.max(0, target - ganadoresConEspera.length);

  return (
    <div>
      {error && (
        <p className="text-sm text-center mb-3" style={{ color: T.goldBright }}>
          {error}
        </p>
      )}

      {nadieJugoNada && (
        <button onClick={onVolver} className="text-xs font-bold mb-3 flex items-center gap-1" style={{ color: T.inkDim }}>
          ← Volver a cuadro directo
        </button>
      )}

      <div className="rounded-2xl p-4 border shadow-sm mb-4" style={{ background: T.panel, borderColor: T.line }}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-bold text-sm" style={{ color: T.gold }}>
            Clasificatoria — {ordenados.length} partido{ordenados.length === 1 ? "" : "s"}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={onCompartir}
              className="h-9 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5"
              style={{ background: "#81C784", color: "#1B3A2A" }}
            >
              <IconWhatsApp color="#1B3A2A" /> Compartir cruces
            </button>
            <button
              onClick={onCopiar}
              title="Copiar"
              className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl"
              style={{ background: T.panel, color: T.ink, border: `1px solid ${T.line}` }}
            >
              <IconCopiar color={T.ink} />
            </button>
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {ordenados.map((m) => {
            const nombre1 = teamsById[m.team1_id]?.name || "?";
            const nombre2 = m.team2_id ? teamsById[m.team2_id]?.name : null;
            const jugado = !!m.winner_id;
            const playable = !jugado && m.team1_id && m.team2_id;
            const filaEstilo = (esGanador) => ({
              color: jugado && !esGanador ? T.inkDim : T.ink,
              textDecoration: jugado && !esGanador ? "line-through" : "none",
              opacity: jugado && !esGanador ? 0.6 : 1,
              cursor: playable ? "pointer" : "default",
            });
            const Fila1 = playable ? "button" : "div";
            const Fila2 = playable ? "button" : "div";
            return (
              <div key={m.id} className="rounded-2xl border p-2" style={{ background: T.panelLight, borderColor: T.line }}>
                <Fila1
                  onClick={playable ? () => onForzarGanador(m, m.team1_id) : undefined}
                  className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold flex items-center justify-between gap-2"
                  style={filaEstilo(m.winner_id === m.team1_id)}
                >
                  <span className="truncate">{nombre1}</span>
                  {jugado && (
                    <span className="font-black flex-shrink-0" style={{ color: T.goldBright }}>
                      {m.score_a}
                    </span>
                  )}
                </Fila1>
                {nombre2 ? (
                  <>
                    <div className="h-px my-1" style={{ background: T.line }} />
                    <Fila2
                      onClick={playable ? () => onForzarGanador(m, m.team2_id) : undefined}
                      className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold flex items-center justify-between gap-2"
                      style={filaEstilo(m.winner_id === m.team2_id)}
                    >
                      <span className="truncate">{nombre2}</span>
                      {jugado && (
                        <span className="font-black flex-shrink-0" style={{ color: T.goldBright }}>
                          {m.score_b}
                        </span>
                      )}
                    </Fila2>
                  </>
                ) : (
                  <div className="text-xs text-center mt-1 py-1.5" style={{ color: T.goldBright }}>
                    espera rival
                  </div>
                )}
                {playable && (
                  <a
                    href={`/partido/${m.match_token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-center text-xs mt-2 py-1.5 rounded-lg font-semibold"
                    style={{ color: T.goldBright, background: T.panel }}
                  >
                    Abrir anotador de esta mesa →
                  </a>
                )}
                {jugado && (
                  <button
                    onClick={() => onReabrir(m)}
                    className="block w-full text-center text-xs mt-2 py-1.5 rounded-lg font-semibold"
                    style={{ color: T.inkDim, background: T.panel }}
                  >
                    Reabrir
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!listoParaCerrar && (
          <div className="flex items-center gap-2 mt-4 pt-4 text-xs" style={{ color: T.inkDim, borderTop: `1px solid ${T.line}` }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: T.gold }} />
            Falta{pendientes.length === 1 ? "" : "n"} {pendientes.length} partido{pendientes.length === 1 ? "" : "s"} —
            "Cerrar clasificatoria" se habilita cuando termina el último.
          </div>
        )}
      </div>

      {listoParaCerrar && (
        <div className="rounded-2xl p-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
          <h2 className="font-bold text-sm mb-1" style={{ color: T.gold }}>
            Cerrar clasificatoria
          </h2>
          <p className="text-xs mb-3" style={{ color: T.inkDim }}>
            {ganadoresConEspera.length} clasifican directo. Elegí {cupo} de los {perdedoresDisponibles.length} perdedores
            para completar un cuadro de {target}.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: T.inkDim }}>
                Clasifican directo ({ganadoresConEspera.length})
              </div>
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                {ganadoresConEspera.map((tid) => (
                  <div
                    key={tid}
                    className="text-sm px-2 py-1.5 rounded-lg"
                    style={{ background: "rgba(111,169,134,0.14)", color: T.ink }}
                  >
                    {teamsById[tid]?.name}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-wide" style={{ color: T.inkDim }}>
                  Perdedores ({perdedoresElegidos.size}/{cupo})
                </div>
                <button
                  onClick={() => onSortearLosers(cupo, perdedoresDisponibles)}
                  className="text-xs font-bold px-2 py-1 rounded-lg"
                  style={{ background: T.panelLight, color: T.goldBright }}
                >
                  🎲 Sortear
                </button>
              </div>
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                {perdedoresDisponibles.map((tid) => {
                  const marcado = perdedoresElegidos.has(tid);
                  return (
                    <button
                      key={tid}
                      onClick={() => onToggleLoser(tid)}
                      className="text-sm px-2 py-1.5 rounded-lg text-left flex items-center gap-2"
                      style={{ background: marcado ? T.panelLight : "transparent", color: marcado ? T.ink : T.inkDim }}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded flex-shrink-0"
                        style={{
                          background: marcado ? T.gold : "transparent",
                          border: `1.5px solid ${marcado ? T.gold : T.line}`,
                        }}
                      />
                      {teamsById[tid]?.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <button
            onClick={onCerrar}
            disabled={cerrando || perdedoresElegidos.size !== cupo}
            className="w-full py-3 rounded-2xl font-black text-sm disabled:opacity-50"
            style={{ background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`, color: T.ink }}
          >
            {cerrando ? "Armando…" : `Armar cuadro de ${target} →`}
          </button>
        </div>
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
  oroHasta,
  setOroHasta,
  onCerrarFase,
  error,
  origin,
  onRecargar,
  onSimular,
  simulando,
  onReabrir,
  setMetodoPago,
  editarJugadores,
  editarNombreEquipo,
  mostrarEquipos,
  setMostrarEquipos,
  busquedaEquipos,
  setBusquedaEquipos,
  onVolver,
}) {
  const grupoMatches = matches.filter((m) => m.bracket === "grupos");
  const numerosGrupos = [...new Set(teams.map((t) => t.grupo).filter((g) => g != null))].sort((a, b) => a - b);
  const grupoTodosJugados = grupoMatches.length > 0 && grupoMatches.every((m) => m.winner_id);
  const hayPendientesGrupos = grupoMatches.some((m) => !m.winner_id);
  const nadieJugoNada = grupoMatches.every((m) => !m.winner_id);
  const [gruposAbiertos, setGruposAbiertos] = useState({});
  const [crucesAbiertos, setCrucesAbiertos] = useState({});
  const [verGrupos, setVerGrupos] = useState(false);
  const [soloClasificados, setSoloClasificados] = useState(false);

  function grupoAbierto(num) {
    return gruposAbiertos[num] === true; // cerrado por default
  }
  function toggleGrupo(num) {
    setGruposAbiertos((prev) => ({ ...prev, [num]: !grupoAbierto(num) }));
  }
  function crucesAbierto(num) {
    return crucesAbiertos[num] !== false; // abierto por default
  }
  function toggleCruces(num) {
    setCrucesAbiertos((prev) => ({ ...prev, [num]: !crucesAbierto(num) }));
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

  function textoCrucesCopa(bracketMatches, tituloCopa) {
    const pendientes = bracketMatches.filter((m) => !m.bye && !m.winner_id && m.team1_id && m.team2_id);
    if (pendientes.length === 0) return null;
    const numeroPorEquipo = {};
    teams.forEach((t, i) => (numeroPorEquipo[t.id] = i + 1));
    const conNumero = (teamId) => {
      const nombre = teamsById[teamId]?.name || "?";
      const num = numeroPorEquipo[teamId];
      return num ? `${num} (${nombre})` : nombre;
    };
    const porRonda = {};
    pendientes.forEach((m) => {
      porRonda[m.round_index] = porRonda[m.round_index] || [];
      porRonda[m.round_index].push(m);
    });
    const bloques = Object.keys(porRonda)
      .map(Number)
      .sort((a, b) => a - b)
      .map((idx) => {
        const totalRonda = bracketMatches.filter((m) => m.round_index === idx).length;
        const nombreRonda = roundLabel(totalRonda);
        const lineas = porRonda[idx].map((m) => `${conNumero(m.team1_id)} vs ${conNumero(m.team2_id)}`);
        return `📋 ${nombreRonda}\n${lineas.join("\n")}`;
      });
    const fecha = tournament.fecha ? ` — ${tournament.fecha}` : "";
    const publicUrl = `${origin}/torneo/${tournament.id}?jugar=1`;
    const titulo = tituloCopa ? ` — ${tituloCopa}` : "";
    return `⚔️ ${tournament.nombre}${titulo}${fecha}\n\n${bloques.join("\n\n")}\n\n${publicUrl}`;
  }

  async function compartirCrucesCopa(bracketMatches, tituloCopa) {
    const texto = textoCrucesCopa(bracketMatches, tituloCopa);
    if (!texto) {
      alert("No hay cruces pendientes en esta copa todavía.");
      return;
    }
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

  function renderTablasDeGrupos() {
    return (
      <>
        {tournament.es_prueba && hayPendientesGrupos && !tournament.copas_generadas && (
          <button
            onClick={onSimular}
            disabled={simulando}
            className="w-full mb-4 py-2.5 rounded-2xl font-bold text-sm disabled:opacity-60"
            style={{ background: T.panelLight, color: T.goldBright, border: `1px dashed ${T.gold}` }}
          >
            {simulando ? "Simulando…" : "Simular fase de grupos al azar (solo para test)"}
          </button>
        )}
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
                      style={{ gridTemplateColumns: "1fr 40px 16px 24px 24px 30px", background: T.panelLight, color: T.inkDim }}
                    >
                      <div>Equipo</div>
                      <div className="text-center">Código</div>
                      <div />
                      <div className="text-center">PJ</div>
                      <div className="text-center">PG</div>
                      <div className="text-center">DIF</div>
                    </div>
                    {tabla.map((row) => (
                      <div
                        key={row.team.id}
                        className="grid gap-1 px-2 py-1.5 text-xs items-center"
                        style={{ gridTemplateColumns: "1fr 40px 16px 24px 24px 30px", borderTop: `1px solid ${T.line}`, color: T.ink }}
                      >
                        <div className="truncate font-semibold">{row.team.name}</div>
                        <div className="text-center" style={{ color: T.inkDim }}>
                          {row.team.codigo}
                        </div>
                        <div />
                        <div className="text-center">{row.pj}</div>
                        <div className="text-center">{row.pg}</div>
                        <div className="text-center">{row.pf - row.pc}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => toggleCruces(num)} className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color: T.inkDim }}>
                        Cruces
                      </span>
                      <span
                        style={{
                          transform: crucesAbierto(num) ? "rotate(180deg)" : "none",
                          transition: "transform 0.15s",
                        }}
                      >
                        <IconAbajo color={T.inkDim} size={10} />
                      </span>
                    </button>
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

                  {crucesAbierto(num) && (
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
                            !tournament.copas_generadas &&
                            (formResultadoId === m.id ? (
                              <ResultadoInlineGrupo
                                T={T}
                                match={m}
                                nombreLocal={teamsById[m.team1_id]?.name}
                                nombreVisitante={teamsById[m.team2_id]?.name}
                                puntosMax={tournament.puntos_max || 30}
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
                  )}
                </>
              )}
            </div>
          );
        })}
      </>
    );
  }

  function bracketSinJugar(bracketMatches) {
    const ronda0 = bracketMatches.filter((m) => m.round_index === 0);
    return ronda0.length > 0 && ronda0.every((m) => m.bye || (!m.winner_id && m.score_a === 0 && m.score_b === 0));
  }

  function fasesListasParaResortearDe(bracketMatches) {
    const porRonda = {};
    bracketMatches.forEach((m) => {
      porRonda[m.round_index] = porRonda[m.round_index] || [];
      porRonda[m.round_index].push(m);
    });
    return Object.keys(porRonda)
      .map(Number)
      .filter((idx) => {
        if (idx === 0) return false;
        const ms = porRonda[idx];
        const completa = ms.every((m) => m.team1_id && m.team2_id);
        const sinJugar = ms.every((m) => !m.winner_id && m.score_a === 0 && m.score_b === 0);
        return completa && sinJugar;
      })
      .sort((a, b) => a - b)
      .map((idx) => ({ idx, cantidad: porRonda[idx].length }));
  }

  async function resortearFaseCopa(bracketName, idx) {
    if (!window.confirm("¿Volver a sortear los cruces de esta fase? Nadie jugó nada todavía ahí, así que es seguro.")) return;
    const { error: err } = await supabase.rpc("resortear_fase", {
      p_tournament_id: tournament.id,
      p_bracket: bracketName,
      p_round_index: idx,
    });
    if (err) {
      console.error(err);
      return;
    }
    onRecargar();
  }

  async function resortearCopaCompleta(bracketName, bracketMatches) {
    if (!window.confirm("¿Volver a sortear este cuadro? Se descarta el cuadro actual y se arma uno nuevo desde cero, con los mismos equipos clasificados.")) return;
    const idsClasificados = [
      ...new Set(
        bracketMatches
          .filter((m) => m.round_index === 0)
          .flatMap((m) => [m.team1_id, m.team2_id])
          .filter(Boolean)
      ),
    ];
    await supabase.from("matches").delete().eq("tournament_id", tournament.id).eq("bracket", bracketName);
    const campo = bracketName === "oro" ? "campeon_oro_id" : "campeon_plata_id";
    await supabase.from("tournaments").update({ [campo]: null }).eq("id", tournament.id);
    const { error: err } = await supabase.rpc("generar_bracket", {
      p_tournament_id: tournament.id,
      p_bracket: bracketName,
      p_team_ids: idsClasificados,
      p_shuffle: true,
    });
    if (err) {
      console.error(err);
      return;
    }
    onRecargar();
  }

  function renderEquiposCard({ conFiltroClasificados, idsClasificados } = {}) {
    return (
      <div className="rounded-2xl p-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
        <button
          onClick={() => setMostrarEquipos((v) => !v)}
          className="w-full flex items-center justify-between font-bold"
          style={{ color: T.gold }}
        >
          <span>Equipos ({teams.length})</span>
          <span style={{ transform: mostrarEquipos ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
            <IconAbajo color={T.inkDim} />
          </span>
        </button>
        {mostrarEquipos && (
          <div className="mt-3">
            <input
              value={busquedaEquipos}
              onChange={(e) => setBusquedaEquipos(e.target.value)}
              placeholder="Buscar equipo (para darle su código)..."
              className="w-full px-3 py-2 rounded-xl text-sm mb-2"
              style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
            />
            {conFiltroClasificados && (
              <label className="flex items-center gap-1.5 text-xs font-bold mb-3" style={{ color: T.inkDim }}>
                <input
                  type="checkbox"
                  checked={soloClasificados}
                  onChange={(e) => setSoloClasificados(e.target.checked)}
                />
                Solo clasificados (los que llegaron al cuadro)
              </label>
            )}
            <TeamList
              teams={teams.filter(
                (t) =>
                  t.name.toLowerCase().includes(busquedaEquipos.toLowerCase()) &&
                  (!conFiltroClasificados || !soloClasificados || idsClasificados.has(t.id))
              )}
              editable
              onSetMetodoPago={setMetodoPago}
              onEditPlayers={editarJugadores}
              onEditName={editarNombreEquipo}
            />
          </div>
        )}
      </div>
    );
  }

  if (tournament.copas_generadas) {
    const oro = matches.filter((m) => m.bracket === "oro");
    const plata = matches.filter((m) => m.bracket === "plata");
    const idsClasificados = new Set(
      [...oro, ...plata].flatMap((m) => [m.team1_id, m.team2_id]).filter(Boolean)
    );
    return (
      <div>
        <div className="rounded-2xl p-4 mb-4 border shadow-sm text-center" style={{ background: T.panel, borderColor: T.line }}>
          <p className="text-sm font-bold mb-2" style={{ color: T.gold }}>
            Fase de grupos cerrada — cuadro armado con los clasificados.
          </p>
          <button
            onClick={() => setVerGrupos((v) => !v)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
          >
            {verGrupos ? "Ocultar fase de grupos ▲" : "Ver fase de grupos ▼"}
          </button>
        </div>

        {verGrupos && <div className="mb-4">{renderTablasDeGrupos()}</div>}

        <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6 lg:items-start">
          <div className="flex flex-col gap-4">
            {renderEquiposCard({ conFiltroClasificados: true, idsClasificados })}
          </div>

          <div className="mt-4 lg:mt-0">
            {tournament.campeon_oro_id && (
              <div
                className="rounded-3xl p-5 mb-5 text-center border-2 shadow-md"
                style={{ background: "#FBF3E3", borderColor: "#EAC27A" }}
              >
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#B85C55" }}>
                  🏆 Campeón{plata.length > 0 ? " — Copa de Oro" : ""}
                </div>
                <div className="text-2xl font-black mt-1" style={{ color: "#33453E" }}>
                  {teamsById[tournament.campeon_oro_id]?.name}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-3 gap-2">
              <h2 className="font-bold" style={{ color: T.gold }}>
                {plata.length > 0 ? "Copa de Oro" : "Cuadro"} — tocá un equipo para forzar el resultado
              </h2>
              {oro.some((m) => !m.bye && !m.winner_id && m.team1_id && m.team2_id) && (
                <button
                  onClick={() => compartirCrucesCopa(oro, plata.length > 0 ? "Copa de Oro" : null)}
                  className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: "#81C784", color: "#1B3A2A" }}
                >
                  📲 Compartir
                </button>
              )}
            </div>
            {fasesListasParaResortearDe(oro).map(({ idx, cantidad }) => (
              <button
                key={idx}
                onClick={() => resortearFaseCopa("oro", idx)}
                className="w-full py-2 rounded-2xl font-bold text-xs mb-3 transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ background: "transparent", color: T.goldBright, border: `1px solid ${T.gold}` }}
              >
                Resortear {roundLabel(cantidad)} (todavía no se jugó nada ahí)
              </button>
            ))}
            {bracketSinJugar(oro) && (
              <button
                onClick={() => resortearCopaCompleta("oro", oro)}
                className="w-full py-2 rounded-2xl font-bold text-xs mb-3 transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ background: "transparent", color: T.goldBright, border: `1px solid ${T.gold}` }}
              >
                Resortear {plata.length > 0 ? "Copa de Oro" : "el cuadro"} (todavía no se jugó nada)
              </button>
            )}
            <BracketDisplayAdmin matches={oro} teamsById={teamsById} origin={origin} onDeclareWinner={onForzarGanador} onReabrir={onReabrir} />

            {plata.length > 0 && (
              <div className="mt-6">
                {tournament.campeon_plata_id && (
                  <div
                    className="rounded-3xl p-5 mb-5 text-center border-2 shadow-md"
                    style={{ background: "#FBF3E3", borderColor: "#EAC27A" }}
                  >
                    <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#B85C55" }}>
                      🏆 Campeón — Copa de Plata
                    </div>
                    <div className="text-2xl font-black mt-1" style={{ color: "#33453E" }}>
                      {teamsById[tournament.campeon_plata_id]?.name}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-3 gap-2">
                  <h2 className="font-bold" style={{ color: T.gold }}>
                    Copa de Plata — tocá un equipo para forzar el resultado
                  </h2>
                  {plata.some((m) => !m.bye && !m.winner_id && m.team1_id && m.team2_id) && (
                    <button
                      onClick={() => compartirCrucesCopa(plata, "Copa de Plata")}
                      className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg"
                      style={{ background: "#81C784", color: "#1B3A2A" }}
                    >
                      📲 Compartir
                    </button>
                  )}
                </div>
                {fasesListasParaResortearDe(plata).map(({ idx, cantidad }) => (
                  <button
                    key={idx}
                    onClick={() => resortearFaseCopa("plata", idx)}
                    className="w-full py-2 rounded-2xl font-bold text-xs mb-3 transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{ background: "transparent", color: T.goldBright, border: `1px solid ${T.gold}` }}
                  >
                    Resortear {roundLabel(cantidad)} (todavía no se jugó nada ahí)
                  </button>
                ))}
                {bracketSinJugar(plata) && (
                  <button
                    onClick={() => resortearCopaCompleta("plata", plata)}
                    className="w-full py-2 rounded-2xl font-bold text-xs mb-3 transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{ background: "transparent", color: T.goldBright, border: `1px solid ${T.gold}` }}
                  >
                    Resortear Copa de Plata (todavía no se jugó nada)
                  </button>
                )}
                <BracketDisplayAdmin matches={plata} teamsById={teamsById} origin={origin} onDeclareWinner={onForzarGanador} onReabrir={onReabrir} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6 lg:items-start">
      <div className="flex flex-col gap-4">{renderEquiposCard()}</div>

      <div className="mt-4 lg:mt-0">
        {renderTablasDeGrupos()}

        {error && (
          <p className="text-sm text-center mb-3" style={{ color: T.goldBright }}>
            {error}
          </p>
        )}

        {nadieJugoNada && (
          <button onClick={onVolver} className="text-xs font-bold mb-3 flex items-center gap-1" style={{ color: T.inkDim }}>
            ← Volver a cuadro directo
          </button>
        )}

        {grupoTodosJugados ? (
          <div className="rounded-2xl p-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
            <p className="text-sm mb-3" style={{ color: T.ink }}>
              Todos los partidos de grupos están jugados. ¿Cuántos clasifican de cada grupo?
            </p>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                min={1}
                value={clasificanPorGrupo}
                onChange={(e) => {
                  const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                  setClasificanPorGrupo(v);
                  if (oroHasta > v) setOroHasta(v);
                }}
                className="w-20 px-3 py-2 rounded-xl text-sm text-center"
                style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
              />
              <span className="text-xs" style={{ color: T.inkDim }}>
                clasifican por grupo
              </span>
            </div>

            {clasificanPorGrupo > 1 && (
              <div className="mb-4">
                <label className="text-xs block mb-1.5" style={{ color: T.inkDim }}>
                  ¿Cuántos de esos van a la Copa de Oro? (el resto arma la Copa de Plata)
                </label>
                <input
                  type="number"
                  min={1}
                  max={clasificanPorGrupo}
                  value={oroHasta}
                  onChange={(e) =>
                    setOroHasta(Math.min(clasificanPorGrupo, Math.max(1, parseInt(e.target.value, 10) || 1)))
                  }
                  className="w-20 px-3 py-2 rounded-xl text-sm text-center"
                  style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                />
                <p className="text-xs mt-1.5" style={{ color: T.inkDim }}>
                  {oroHasta < clasificanPorGrupo
                    ? `1° a ${oroHasta}° → Copa de Oro. ${oroHasta + 1}° a ${clasificanPorGrupo}° → Copa de Plata.`
                    : "Todos los clasificados van a un solo cuadro (sin Copa de Plata)."}
                </p>
              </div>
            )}

            <button
              onClick={onCerrarFase}
              className="w-full py-2.5 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`, color: T.ink }}
            >
              Cerrar fase de grupos y armar cuadro
            </button>
          </div>
        ) : (
          <p className="text-xs text-center" style={{ color: T.inkDim }}>
            Faltan partidos de grupos por jugar.
          </p>
        )}
      </div>
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
        <div className="mb-6">
          <button
            onClick={() => setAbiertoPendientes((v) => !v)}
            className="w-full flex items-center justify-between mb-2.5 lg:pointer-events-none"
          >
            <h2 className="text-xs font-extrabold uppercase tracking-wide" style={{ color: T.inkDim }}>
              Por jugar ({pendientes.length})
            </h2>
            <span className="text-xs lg:hidden" style={{ color: T.gold }}>
              {abiertoPendientes ? "▲" : "▼"}
            </span>
          </button>
          <div
            className={`${abiertoPendientes ? "grid" : "hidden"} lg:grid gap-3`}
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
          >
            {pendientes.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border p-3.5 shadow-sm flex flex-col gap-2"
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
        </div>
      )}

      {jugados.length > 0 && (
        <div>
          <button
            onClick={() => setAbiertoJugados((v) => !v)}
            className="w-full flex items-center justify-between mb-2.5 lg:pointer-events-none"
          >
            <h2 className="text-xs font-extrabold uppercase tracking-wide" style={{ color: T.inkDim }}>
              Ya jugados ({jugados.length})
            </h2>
            <span className="text-xs lg:hidden" style={{ color: T.gold }}>
              {abiertoJugados ? "▲" : "▼"}
            </span>
          </button>
          <div
            className={`${abiertoJugados ? "grid" : "hidden"} lg:grid gap-2.5`}
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
          >
            {jugados.map((m) => {
              const gano1 = m.winner_id === m.team1_id;
              const gano2 = m.winner_id === m.team2_id;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl border text-sm"
                  style={{ background: T.bg, borderColor: T.line }}
                >
                  <span
                    className="truncate flex-1"
                    style={{ color: gano1 ? T.ink : T.inkDim, textDecoration: gano2 ? "line-through" : "none" }}
                  >
                    {teamsById[m.team1_id]?.name} <b style={{ color: gano1 ? T.goldBright : T.inkDim }}>{m.score_a ?? 0}</b>
                  </span>
                  <span className="text-xs flex-shrink-0" style={{ color: T.inkDim }}>
                    vs
                  </span>
                  <span
                    className="truncate flex-1 text-right"
                    style={{ color: gano2 ? T.ink : T.inkDim, textDecoration: gano1 ? "line-through" : "none" }}
                  >
                    <b style={{ color: gano2 ? T.goldBright : T.inkDim }}>{m.score_b ?? 0}</b> {teamsById[m.team2_id]?.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Envuelve BracketDisplay agregando, debajo del cuadro, la lista de
// tanteadores ya jugados con botón para reabrirlos — lo único que
// BracketDisplay no trae de fábrica. El link directo a cada mesa por
// jugar ya lo muestra BracketDisplay solo (adminMode + tournamentUrl).
function BracketDisplayAdmin({
  matches,
  teamsById,
  origin,
  onDeclareWinner,
  onReabrir,
  modoVidon,
  equiposLibresVidon,
  onAsignarCasillero,
  onQuitarCasillero,
  onSaltarCasillero,
}) {
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
        modoVidon={modoVidon}
        equiposLibresVidon={equiposLibresVidon}
        onAsignarCasillero={onAsignarCasillero}
        onQuitarCasillero={onQuitarCasillero}
        onSaltarCasillero={onSaltarCasillero}
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
                    ↺ Reabrir
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
