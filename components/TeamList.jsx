"use client";
import React, { useState } from "react";
import { useTheme } from "../lib/theme";
import { INK_ON_LIGHT } from "../lib/theme";
import { IconLapiz, IconBasura } from "./LineIcons";

export default function TeamList({ teams, onTogglePaid, onRemove, onEditPlayers, editable }) {
  const { T } = useTheme();
  const [editandoId, setEditandoId] = useState(null);
  const [valorEdit, setValorEdit] = useState("");
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);
  const [orden, setOrden] = useState("nombre_asc");

  const ordenados = [...teams].sort((a, b) => {
    if (orden === "nombre_asc") return a.name.localeCompare(b.name);
    if (orden === "nombre_desc") return b.name.localeCompare(a.name);
    if (orden === "creado_asc") return new Date(a.created_at) - new Date(b.created_at);
    if (orden === "creado_desc") return new Date(b.created_at) - new Date(a.created_at);
    if (orden === "debe_primero") return (a.paid ? 1 : 0) - (b.paid ? 1 : 0) || a.name.localeCompare(b.name);
    return 0;
  });

  function empezarEdicion(t) {
    setEditandoId(t.id);
    setValorEdit(t.players || "");
  }
  function guardarEdicion(teamId) {
    onEditPlayers(teamId, valorEdit.trim());
    setEditandoId(null);
  }

  return (
    <div>
      {teams.length > 1 && (
        <div className="flex justify-end mb-2">
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
            <option value="debe_primero">Debe primero</option>
          </select>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {ordenados.map((t, i) => (
          <div
            key={t.id}
            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors duration-200"
            style={{ background: T.panelLight }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: T.gold, color: INK_ON_LIGHT }}
            >
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: T.ink }}>
                {t.name}
              </div>
              {editandoId === t.id ? (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    value={valorEdit}
                    onChange={(e) => setValorEdit(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && guardarEdicion(t.id)}
                    placeholder="Nombres de los jugadores"
                    autoFocus
                    className="flex-1 min-w-0 px-2 py-1 rounded-lg text-xs"
                    style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                  />
                  <button
                    onClick={() => guardarEdicion(t.id)}
                    className="text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0"
                    style={{ background: T.gold, color: INK_ON_LIGHT }}
                  >
                    OK
                  </button>
                </div>
              ) : (
                t.players && (
                  <div className="text-xs truncate" style={{ color: T.inkDim }}>
                    {t.players}
                  </div>
                )
              )}
              {t.codigo && (
                <div className="text-xs font-mono mt-0.5" style={{ color: T.inkDim }}>
                  🔑 {t.codigo}
                </div>
              )}
            </div>
            <button
              onClick={() => onTogglePaid(t.id, !t.paid)}
              className="text-xs px-2 py-1 rounded-full font-bold transition-colors duration-200 flex-shrink-0"
              style={{
                background: t.paid ? T.gold : "transparent",
                color: t.paid ? INK_ON_LIGHT : T.inkDim,
                border: `1px solid ${T.gold}`,
              }}
            >
              {t.paid ? "Pagó" : "Debe"}
            </button>
            {editable && onEditPlayers && editandoId !== t.id && (
              <button
                onClick={() => empezarEdicion(t)}
                title={t.players ? "Editar jugadores" : "Agregar jugadores"}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: T.panel }}
              >
                <IconLapiz color={T.goldBright} />
              </button>
            )}
            {editable &&
              onRemove &&
              (confirmarBorrar === t.id ? (
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      onRemove(t.id);
                      setConfirmarBorrar(null);
                    }}
                    className="text-xs font-bold px-2 py-1.5 rounded-lg"
                    style={{ background: T.redDim, color: "#FFFFFF" }}
                  >
                    confirmar
                  </button>
                  <button onClick={() => setConfirmarBorrar(null)} className="text-xs px-1.5" style={{ color: T.inkDim }}>
                    no
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmarBorrar(t.id)}
                  title="Quitar equipo"
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: T.panel }}
                >
                  <IconBasura color={T.redDim} />
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
