"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "../../../lib/theme";
import { supabase } from "../../../lib/supabaseClient";
import { fraseCampeonAlAzar } from "../../../lib/champFrases";
import BracketDisplay from "../../../components/BracketDisplay";
import ThemeToggleButton from "../../../components/ThemeToggleButton";
import { IconAtras, IconAbajo } from "../../../components/LineIcons";
import MiEquipoPanel from "../../../components/MiEquipoPanel";

export default function TorneoPublico({ params, searchParams }) {
  const { id } = params;
  const volverToken = searchParams?.volver;
  // Solo se puede elegir equipo entrando por el link que comparte el
  // organizador (?jugar=1) — si llegaste navegando por /en-vivo, es
  // modo espectador nada más, para que un desconocido no pueda
  // hacerse pasar por un equipo que no es suyo.
  const puedeElegirEquipo = searchParams?.jugar === "1";
  const { T } = useTheme();
  const router = useRouter();
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: t } = await supabase.from("tournaments").select("*").eq("id", id).single();
    const { data: ts } = await supabase
      .from("teams")
      .select("id, tournament_id, name, players, paid, created_at, grupo")
      .eq("tournament_id", id);
    const { data: ms } = await supabase
      .from("matches")
      .select("id, tournament_id, bracket, grupo, round_index, match_index, team1_id, team2_id, winner_id, score_a, score_b, bye")
      .eq("tournament_id", id);
    setTournament(t);
    setTeams(ts || []);
    setMatches(ms || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`torneo-publico-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${id}` }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [id, load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.ink }}>
        Cargando el mazo…
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

  const teamsById = {};
  teams.forEach((t) => (teamsById[t.id] = t));
  const mainMatchesTodos = matches.filter((m) => m.bracket === "main");
  const repMatches = matches.filter((m) => m.bracket === "repechaje");
  const grupoMatches = matches.filter((m) => m.bracket === "grupos");
  const oroMatches = matches.filter((m) => m.bracket === "oro");
  const plataMatches = matches.filter((m) => m.bracket === "plata");
  const enFaseDeGrupos = tournament.formato === "grupos";

  // Los competidores no ven una fase hasta que la anterior termina del
  // todo (mismo criterio que usa el mensaje de WhatsApp del organizador:
  // no se adelanta nada de la fase siguiente hasta cerrar la actual).
  function rondaMaximaVisible(ms) {
    const porRonda = {};
    ms.forEach((m) => {
      porRonda[m.round_index] = porRonda[m.round_index] || [];
      porRonda[m.round_index].push(m);
    });
    const indices = Object.keys(porRonda).map(Number).sort((a, b) => a - b);
    let max = 0;
    for (const idx of indices) {
      if (idx === 0) continue;
      const anterior = porRonda[idx - 1] || [];
      const anteriorCompleta = anterior.length > 0 && anterior.every((m) => m.bye || m.winner_id);
      if (anteriorCompleta) max = idx;
      else break;
    }
    return max;
  }
  const maxVisibleMain = rondaMaximaVisible(mainMatchesTodos);
  const mainMatches = mainMatchesTodos.filter((m) => m.round_index <= maxVisibleMain);

  const hayFasesOcultas = mainMatchesTodos.length > mainMatches.length;

  return (
    <div className="transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-3xl lg:max-w-[92vw] xl:max-w-[1500px] mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => {
              // Si llegaron con un link compartido (WhatsApp, etc.) no hay
              // historial previo en esta pestaña — ahí volvemos a Inicio
              // en vez de dejar el botón sin hacer nada.
              if (typeof window !== "undefined" && window.history.length > 1) router.back();
              else router.push("/");
            }}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: T.panel, border: `1px solid ${T.line}` }}
          >
            <IconAtras color={T.ink} />
          </button>
          <ThemeToggleButton />
        </div>
        <h1 className="text-3xl font-black text-center" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
          {tournament.nombre || "Torneo sin nombre"}
        </h1>
        <p className="text-center text-sm mb-6" style={{ color: T.goldBright }}>
          {[tournament.ubicacion, tournament.fecha, tournament.categoria].filter(Boolean).join(" · ")}
        </p>

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
          <>
            {tournament.grupos_generados && (
              <MiEquipoPanel
                tournament={tournament}
                teams={teams}
                matches={tournament.copas_generadas ? [...oroMatches, ...plataMatches] : grupoMatches}
                teamsById={teamsById}
                puedeElegir={puedeElegirEquipo}
              />
            )}

            {!tournament.grupos_generados ? (
              <p className="text-center text-sm" style={{ color: T.inkDim }}>
                El sorteo todavía no se hizo.
              </p>
            ) : !tournament.copas_generadas ? (
              <FaseDeGruposPublica teams={teams} matches={grupoMatches} teamsById={teamsById} />
            ) : (
              <>
                {tournament.campeon_oro_id && (
                  <div
                    className="rounded-3xl p-5 mb-5 text-center border-2 shadow-md"
                    style={{ background: "#FBF3E3", borderColor: "#EAC27A" }}
                  >
                    <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#B85C55" }}>
                      🏆 Campeón{plataMatches.length > 0 ? " — Copa de Oro" : ""}
                    </div>
                    <div className="text-2xl font-black mt-1" style={{ color: "#33453E" }}>
                      {teamsById[tournament.campeon_oro_id]?.name}
                    </div>
                    <div className="text-xs mt-1 italic" style={{ color: "#B85C55" }}>
                      {fraseCampeonAlAzar()}
                    </div>
                  </div>
                )}
                <BracketDisplay matches={oroMatches} teamsById={teamsById} />

                {plataMatches.length > 0 && (
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
                        <div className="text-xs mt-1 italic" style={{ color: "#B85C55" }}>
                          {fraseCampeonAlAzar()}
                        </div>
                      </div>
                    )}
                    <h2 className="font-bold mb-3" style={{ color: T.gold }}>
                      Copa de Plata
                    </h2>
                    <BracketDisplay matches={plataMatches} teamsById={teamsById} />
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {tournament.started && (
              <MiEquipoPanel
                tournament={tournament}
                teams={teams}
                matches={mainMatches}
                teamsById={teamsById}
                puedeElegir={puedeElegirEquipo}
              />
            )}

            {!tournament.started ? (
              <p className="text-center text-sm" style={{ color: T.inkDim }}>
                El sorteo todavía no se hizo.
              </p>
            ) : (
              <>
                <BracketDisplay matches={mainMatches} teamsById={teamsById} />
                {hayFasesOcultas && (
                  <p className="text-center text-xs mt-3" style={{ color: T.inkDim }}>
                    Las siguientes fases se muestran apenas termine la actual.
                  </p>
                )}
                {tournament.repechaje && tournament.modo === "directa" && (
                  <div className="mt-6">
                    {tournament.repechaje_champion_id && (
                      <div
                        className="rounded-3xl p-5 mb-5 text-center border-2 shadow-md"
                        style={{ background: "#FBF3E3", borderColor: "#EAC27A" }}
                      >
                        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#B85C55" }}>
                          🏆 Campeón del repechaje
                        </div>
                        <div className="text-2xl font-black mt-1" style={{ color: "#33453E" }}>
                          {teamsById[tournament.repechaje_champion_id]?.name}
                        </div>
                        {teamsById[tournament.repechaje_champion_id]?.players && (
                          <div className="text-sm mt-0.5" style={{ color: "#33453E" }}>
                            {teamsById[tournament.repechaje_champion_id].players}
                          </div>
                        )}
                        <div className="text-xs mt-1 italic" style={{ color: "#B85C55" }}>
                          {fraseCampeonAlAzar()}
                        </div>
                      </div>
                    )}
                    <h2 className="font-bold mb-3" style={{ color: T.gold }}>
                      Cuadro de repechaje
                    </h2>
                    {repMatches.length === 0 ? (
                      <p className="text-sm" style={{ color: T.inkDim }}>
                        Se arma solo apenas termine toda la primera ronda del cuadro principal.
                      </p>
                    ) : (
                      <BracketDisplay matches={repMatches} teamsById={teamsById} />
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {volverToken && (
        <Link
          href={`/partido/${volverToken}`}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full font-bold text-sm shadow-lg transition-transform duration-150 active:scale-95"
          style={{ background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`, color: T.ink }}
        >
          ← Volver a mi partido
        </Link>
      )}
    </div>
  );
}

// Vista pública (sin login) de la fase de grupos: tabla de posiciones y
// cruces de cada grupo, de solo lectura — nada de códigos ni links de
// anotador acá, esos solo se comparten en privado con cada equipo.
function FaseDeGruposPublica({ teams, matches, teamsById }) {
  const { T } = useTheme();
  const numerosGrupos = [...new Set(teams.map((t) => t.grupo).filter((g) => g != null))].sort((a, b) => a - b);
  const [abiertos, setAbiertos] = useState({});
  const abierto = (n) => abiertos[n] !== false; // abierto por default

  return (
    <div>
      <p className="text-center text-sm mb-4" style={{ color: T.inkDim }}>
        Fase de grupos en curso.
      </p>
      {numerosGrupos.map((num) => {
        const partidosGrupo = matches
          .filter((m) => m.grupo === num)
          .sort((a, b) => a.round_index - b.round_index || a.match_index - b.match_index);

        const stats = {};
        teams
          .filter((t) => t.grupo === num)
          .forEach((t) => {
            stats[t.id] = { team: t, pj: 0, pg: 0, pf: 0, pc: 0 };
          });
        partidosGrupo
          .filter((m) => m.winner_id)
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
        const tabla = Object.values(stats).sort((a, b) => b.pg - a.pg || b.pf - b.pc - (a.pf - a.pc));

        return (
          <div key={num} className="rounded-2xl p-4 mb-4 border shadow-sm" style={{ background: T.panel, borderColor: T.line }}>
            <button
              onClick={() => setAbiertos((prev) => ({ ...prev, [num]: !abierto(num) }))}
              className="w-full flex items-center justify-between mb-3"
            >
              <h3 className="font-bold" style={{ color: T.gold }}>
                Grupo {num}
              </h3>
              <span style={{ transform: abierto(num) ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                <IconAbajo color={T.inkDim} />
              </span>
            </button>

            {abierto(num) && (
              <>
                <div className="rounded-xl border overflow-hidden mb-3" style={{ borderColor: T.line }}>
                  <div
                    className="grid gap-1 px-2 py-1.5 text-[10px] font-extrabold uppercase"
                    style={{ gridTemplateColumns: "1fr 30px 30px 34px", background: T.panelLight, color: T.inkDim }}
                  >
                    <div>Equipo</div>
                    <div className="text-center">PJ</div>
                    <div className="text-center">PG</div>
                    <div className="text-center">DIF</div>
                  </div>
                  {tabla.map((row) => (
                    <div
                      key={row.team.id}
                      className="grid gap-1 px-2 py-1.5 text-xs items-center"
                      style={{ gridTemplateColumns: "1fr 30px 30px 34px", borderTop: `1px solid ${T.line}`, color: T.ink }}
                    >
                      <div className="truncate font-semibold">{row.team.name}</div>
                      <div className="text-center">{row.pj}</div>
                      <div className="text-center">{row.pg}</div>
                      <div className="text-center">{row.pf - row.pc}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  {partidosGrupo.map((m) => (
                    <div
                      key={m.id}
                      className="text-xs px-2.5 py-2 rounded-lg flex items-center justify-between gap-2"
                      style={{ background: T.panelLight }}
                    >
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <span className="truncate" style={{ color: m.winner_id === m.team1_id ? T.goldBright : T.ink }}>
                          {teamsById[m.team1_id]?.name}
                        </span>
                        <b className="flex-shrink-0" style={{ color: T.inkDim, fontSize: 10 }}>
                          vs
                        </b>
                        <span className="truncate" style={{ color: m.winner_id === m.team2_id ? T.goldBright : T.ink }}>
                          {teamsById[m.team2_id]?.name}
                        </span>
                      </div>
                      {m.winner_id ? (
                        <span className="font-bold flex-shrink-0" style={{ color: T.goldBright }}>
                          {m.score_a}-{m.score_b}
                        </span>
                      ) : (
                        <span className="text-[11px] flex-shrink-0" style={{ color: T.inkDim }}>
                          por jugar
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
