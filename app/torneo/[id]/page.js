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
import { rankearGrupo } from "../../../lib/fasesDeGrupos.mjs";

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
  const enClasificatoria = tournament.formato === "clasificatoria" && !tournament.clasificatoria_cerrada;
  const clasifMatches = matches.filter((m) => m.bracket === "clasificatoria");
  const enFaseDeGrupos = tournament.formato === "grupos";
  const grupoMatches = matches.filter((m) => m.bracket === "grupos");
  const oroMatches = matches.filter((m) => m.bracket === "oro");
  const plataMatches = matches.filter((m) => m.bracket === "plata");

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

        {enClasificatoria ? (
          <>
            {tournament.clasificatoria_generada && (
              <MiEquipoPanel
                tournament={tournament}
                teams={teams}
                matches={clasifMatches}
                teamsById={teamsById}
                puedeElegir={puedeElegirEquipo}
              />
            )}

            {!tournament.clasificatoria_generada ? (
              <p className="text-center text-sm" style={{ color: T.inkDim }}>
                El sorteo todavía no se hizo.
              </p>
            ) : (
              <ClasificatoriaPublica matches={clasifMatches} teamsById={teamsById} />
            )}
          </>
        ) : enFaseDeGrupos ? (
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
              <GruposPublico teams={teams} grupoMatches={grupoMatches} teamsById={teamsById} />
            ) : (
              <>
                {oroMatches.length > 0 && (
                  <div className="mb-6">
                    {tournament.campeon_oro_id && (
                      <div
                        className="rounded-3xl p-5 mb-5 text-center border-2 shadow-md"
                        style={{ background: "#FBF3E3", borderColor: "#EAC27A" }}
                      >
                        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#B85C55" }}>
                          🏆 Campeón — Copa de Oro
                        </div>
                        <div className="text-2xl font-black mt-1" style={{ color: "#33453E" }}>
                          {teamsById[tournament.campeon_oro_id]?.name}
                        </div>
                        <div className="text-xs mt-1 italic" style={{ color: "#B85C55" }}>
                          {fraseCampeonAlAzar()}
                        </div>
                      </div>
                    )}
                    <h2 className="font-bold mb-3" style={{ color: T.gold }}>
                      Copa de Oro
                    </h2>
                    <BracketDisplay matches={oroMatches} teamsById={teamsById} />
                  </div>
                )}
                {plataMatches.length > 0 && (
                  <div>
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

// Vista pública (sin login) de la clasificatoria: la lista de cruces,
// sin botones de admin — solo mirar. MiEquipoPanel ya se encarga de
// mostrarle a cada uno su propio partido, esto es el panorama completo.
function ClasificatoriaPublica({ matches, teamsById }) {
  const { T } = useTheme();
  const ordenados = [...matches].sort((a, b) => a.match_index - b.match_index);

  return (
    <div>
      <p className="text-center text-sm mb-4" style={{ color: T.inkDim }}>
        Clasificatoria en curso — de acá salen los que arman el cuadro.
      </p>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {ordenados.map((m) => {
          const equipo1 = teamsById[m.team1_id];
          const equipo2 = m.team2_id ? teamsById[m.team2_id] : null;
          const nombre1 = equipo1?.name || "?";
          const nombre2 = equipo2?.name || null;
          const jugado = !!m.winner_id;
          const fila = (esGanador) => ({
            color: jugado && !esGanador ? T.inkDim : T.ink,
            textDecoration: jugado && !esGanador ? "line-through" : "none",
            opacity: jugado && !esGanador ? 0.6 : 1,
          });
          return (
            <div key={m.id} className="rounded-2xl border p-2" style={{ background: T.panel, borderColor: T.line }}>
              <div className="px-3 py-2 rounded-xl flex items-center justify-between gap-2" style={fila(m.winner_id === m.team1_id)}>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{nombre1}</div>
                  {equipo1?.players && <div className="text-[11px] truncate opacity-80">{equipo1.players}</div>}
                </div>
                {m.score_a > 0 && (
                  <span className="font-black flex-shrink-0" style={{ color: T.goldBright }}>
                    {m.score_a}
                  </span>
                )}
              </div>
              {nombre2 ? (
                <>
                  <div className="h-px my-1" style={{ background: T.line }} />
                  <div className="px-3 py-2 rounded-xl flex items-center justify-between gap-2" style={fila(m.winner_id === m.team2_id)}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{nombre2}</div>
                      {equipo2?.players && <div className="text-[11px] truncate opacity-80">{equipo2.players}</div>}
                    </div>
                    {m.score_b > 0 && (
                      <span className="font-black flex-shrink-0" style={{ color: T.goldBright }}>
                        {m.score_b}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-xs text-center mt-1 py-1.5" style={{ color: T.goldBright }}>
                  espera rival
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Vista pública (sin login) de la fase de grupos: tabla de posiciones +
// fixture de cada grupo, solo para mirar. Misma tabla que usa el panel
// del organizador (rankearGrupo() de lib/fasesDeGrupos.mjs).
function GruposPublico({ teams, grupoMatches, teamsById }) {
  const { T } = useTheme();
  const numerosDeGrupo = [...new Set(teams.filter((t) => t.grupo != null).map((t) => t.grupo))].sort((a, b) => a - b);

  return (
    <div>
      <p className="text-center text-sm mb-4" style={{ color: T.inkDim }}>
        Fase de grupos en curso.
      </p>
      {numerosDeGrupo.map((num) => {
        const equipoIds = teams.filter((t) => t.grupo === num).map((t) => t.id);
        const ms = grupoMatches.filter((m) => m.grupo === num);
        const partidos = ms.map((m) => ({
          team1Id: m.team1_id,
          team2Id: m.team2_id,
          winnerId: m.winner_id,
          scoreA: m.score_a,
          scoreB: m.score_b,
        }));
        const tabla = rankearGrupo(equipoIds, partidos);
        const porFecha = {};
        ms.forEach((m) => {
          porFecha[m.round_index] = porFecha[m.round_index] || [];
          porFecha[m.round_index].push(m);
        });
        const fechas = Object.keys(porFecha).map(Number).sort((a, b) => a - b);
        return (
          <div key={num} className="rounded-2xl p-4 border shadow-sm mb-4" style={{ background: T.panel, borderColor: T.line }}>
            <h2 className="font-bold text-sm mb-3" style={{ color: T.gold }}>
              Grupo {num}
            </h2>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs" style={{ color: T.ink }}>
                <thead>
                  <tr style={{ color: T.inkDim }}>
                    <th className="text-left font-bold pb-1.5">Equipo</th>
                    <th className="text-center font-bold pb-1.5">PJ</th>
                    <th className="text-center font-bold pb-1.5">PG</th>
                    <th className="text-center font-bold pb-1.5">Dif</th>
                  </tr>
                </thead>
                <tbody>
                  {tabla.map((e) => (
                    <tr key={e.id} style={{ borderTop: `1px solid ${T.line}` }}>
                      <td className="py-1.5 font-semibold truncate max-w-[160px]">
                        {e.posicion}. {teamsById[e.id]?.name}
                      </td>
                      <td className="text-center py-1.5">{e.pj}</td>
                      <td className="text-center py-1.5">{e.pg}</td>
                      <td className="text-center py-1.5">{e.dif > 0 ? `+${e.dif}` : e.dif}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {fechas.map((fecha) => (
              <div key={fecha} className="mb-3">
                <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: T.inkDim }}>
                  Fecha {fecha + 1}
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                  {porFecha[fecha].map((m) => {
                    const jugado = !!m.winner_id;
                    return (
                      <div key={m.id} className="rounded-xl border p-2 text-xs" style={{ background: T.panelLight, borderColor: T.line }}>
                        <div className="flex items-center justify-between gap-2 px-1 py-0.5" style={{ color: jugado && m.winner_id !== m.team1_id ? T.inkDim : T.ink }}>
                          <span className="truncate">{teamsById[m.team1_id]?.name}</span>
                          {jugado && <span className="font-black" style={{ color: T.goldBright }}>{m.score_a}</span>}
                        </div>
                        <div className="flex items-center justify-between gap-2 px-1 py-0.5" style={{ color: jugado && m.winner_id !== m.team2_id ? T.inkDim : T.ink }}>
                          <span className="truncate">{teamsById[m.team2_id]?.name}</span>
                          {jugado && <span className="font-black" style={{ color: T.goldBright }}>{m.score_b}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

