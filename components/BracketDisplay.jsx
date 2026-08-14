"use client";
import React from "react";
import { useTheme } from "../lib/theme";
import SuitIcon, { SUITS } from "./SuitIcon";
import { groupByRound, roundLabel } from "../lib/bracket";

export default function BracketDisplay({
  matches,
  teamsById,
  adminMode,
  tournamentUrl,
  onDeclareWinner,
  modoVidon,
  equiposLibresVidon,
  onAsignarCasillero,
  onQuitarCasillero,
}) {
  const { T } = useTheme();
  if (!matches || matches.length === 0) return null;
  const rounds = groupByRound(matches);
  const nameOf = (id) => (id ? teamsById[id]?.name || "???" : null);

  function renderMatchCard(m) {
    const playable = adminMode && !!onDeclareWinner && !m.bye && !m.winner_id && m.team1_id && m.team2_id;
    // Vidón (u otro): un equipo quedó solo esperando rival y nadie
    // reingresó — el organizador puede hacerlo pasar directo.
    const soloEsperando = adminMode && !!onDeclareWinner && !m.bye && !m.winner_id && m.team1_id && !m.team2_id;
    // Reingresos: solo en la ronda 0 de un torneo Vidón, sin jugar
    // todavía, y solo el organizador puede tocarlo.
    const esReingreso = adminMode && modoVidon && m.round_index === 0 && !m.winner_id && !m.bye;
    return (
      <div
        key={m.id}
        className="rounded-2xl border p-2 shadow-sm transition-all duration-300"
        style={{
          background: T.panel,
          borderColor: m.bye ? T.line : m.winner_id ? T.gold : T.line,
          opacity: m.bye ? 0.65 : 1,
        }}
      >
        {[m.team1_id, m.team2_id].map((tid, i) => {
          const isWinner = m.winner_id && m.winner_id === tid;
          const isLoser = m.winner_id && tid && m.winner_id !== tid;
          const label = tid ? nameOf(tid) : m.bye ? (i === 1 ? "LIBRE" : "—") : "Por definir";
          const score = i === 0 ? m.score_a : m.score_b;
          const Tag = playable ? "button" : "div";

          if (esReingreso && !tid) {
            return (
              <div key={i}>
                {i === 1 && <div className="h-px my-1" style={{ background: T.line }} />}
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) onAsignarCasillero(m.id, e.target.value);
                  }}
                  className="w-full text-xs px-2 py-2 rounded-xl"
                  style={{ background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` }}
                >
                  <option value="">— elegí quién reingresa —</option>
                  {(equiposLibresVidon || []).map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          return (
            <div key={i}>
              {i === 1 && <div className="h-px my-1" style={{ background: T.line }} />}
              <div className="flex items-center gap-1">
                <Tag
                  onClick={playable ? () => onDeclareWinner(m, tid) : undefined}
                  className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold truncate flex items-center justify-between gap-2 transition-colors duration-150"
                  style={{
                    color: isWinner ? T.goldBright : isLoser ? T.inkDim : T.ink,
                    opacity: isLoser ? 0.5 : 1,
                    textDecoration: isLoser ? "line-through" : "none",
                    background: isWinner ? "rgba(234,194,122,0.25)" : "transparent",
                    cursor: playable ? "pointer" : "default",
                  }}
                >
                  <span className="truncate">{label}</span>
                  {!m.bye && score > 0 && (
                    <span className="font-black text-base flex-shrink-0" style={{ color: T.goldBright }}>
                      {score}
                    </span>
                  )}
                </Tag>
                {esReingreso && tid && (
                  <button
                    onClick={() => onQuitarCasillero(m.id, tid)}
                    className="w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs"
                    style={{ background: T.redDim, color: "#FFFFFF" }}
                    title="Sacar de este casillero"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {m.bye && (
          <div className="text-xs text-center mt-1" style={{ color: T.inkDim }}>
            Pasa libre de ronda
          </div>
        )}
        {playable && (
          <div className="text-[11px] text-center mt-1" style={{ color: T.inkDim }}>
            tocá el ganador para forzarlo
          </div>
        )}
        {soloEsperando && (
          <button
            onClick={() => onDeclareWinner(m, m.team1_id)}
            className="block w-full text-center text-xs mt-2 py-1.5 rounded-lg font-semibold"
            style={{ color: T.goldBright, background: T.panelLight }}
          >
            Nadie reingresó → Pasa directo de ronda.
          </button>
        )}
        {adminMode && !m.bye && !m.winner_id && m.team1_id && m.team2_id && (
          <a
            href={`${tournamentUrl}/partido/${m.match_token}`}
            target="_blank"
            rel="noreferrer"
            className="block text-center text-xs mt-2 py-1.5 rounded-lg font-semibold"
            style={{ color: T.goldBright, background: T.panelLight }}
          >
            Abrir anotador de esta mesa →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className="grid gap-4 lg:gap-6 overflow-x-auto pb-2 scroll-smooth"
        style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(210px, 1fr))` }}
      >
      {rounds.map((round, rIdx) => (
        <div key={rIdx} className="min-w-0 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-3 justify-center">
            <SuitIcon suit={SUITS[rIdx % 4]} size={15} />
            <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: T.gold }}>
              {roundLabel(round.length)}
            </h3>
          </div>
          {rIdx === 0 ? (
            <div className="flex flex-col gap-4">{round.map((m) => renderMatchCard(m))}</div>
          ) : (
            // Cada partido de esta ronda queda centrado entre los dos que lo
            // alimentan: los espaciadores crecen en potencias de 2 según la
            // ronda, en vez de apilar todo arriba.
            <div className="flex-1 flex flex-col">
              <div style={{ flexGrow: 2 ** (rIdx - 1) }} />
              {round.map((m, mIdx) => (
                <React.Fragment key={m.id}>
                  {renderMatchCard(m)}
                  {mIdx < round.length - 1 && <div style={{ flexGrow: 2 ** rIdx }} />}
                </React.Fragment>
              ))}
              <div style={{ flexGrow: 2 ** (rIdx - 1) }} />
            </div>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}
