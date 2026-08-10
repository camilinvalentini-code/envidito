"use client";
import React, { useState } from "react";
import { useTheme } from "../lib/theme";
import { INK_ON_LIGHT } from "../lib/theme";
import { IconLapiz, IconBasura } from "./LineIcons";

function siguienteMetodo(actual) {
  if (actual === "efectivo") return "transferencia";
  if (actual === "transferencia") return null;
  return "efectivo";
}

export default function TeamList({ teams, onSetMetodoPago, onRemove, onEditPlayers, onEditName, editable }) {
  const { T } = useTheme();
  const [editandoId, setEditandoId] = useState(null);
  const [valorNombre, setValorNombre] = useState("");
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
    setValorNombre(t.name || "");
    setValorEdit(t.players || "");
  }
  function guardarEdicion(teamId) {
    if (onEditName && valorNombre.trim()) onEditName(teamId, valorNombre.trim());
    if (onEditPlayers) onEditPlayers(teamId, valorEdit.trim());
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
              {editandoId === t.id ? (
                <div className="flex flex-col gap-1">
                  {onEditName && (
                    <input
                      value={valorNombre}
                      onChange={(e) => setValorNombre(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && guardarEdicion(t.id)}
                      placeholder="Nombre del equipo"
                      autoFocus
                      className="w-full px-2 py-1 rounded-lg text-sm font-semibold"
                      style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                    />
                  )}
                  {onEditPlayers && (
                    <input
                      value={valorEdit}
                      onChange={(e) => setValorEdit(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && guardarEdicion(t.id)}
                      placeholder="Nombres de los jugadores"
                      autoFocus={!onEditName}
                      className="w-full px-2 py-1 rounded-lg text-xs"
                      style={{ background: T.bg, color: T.ink, border: `1px solid ${T.line}` }}
                    />
                  )}
                  <button
                    onClick={() => guardarEdicion(t.id)}
                    className="self-start text-xs font-bold px-2.5 py-1 rounded-lg"
                    style={{ background: T.gold, color: INK_ON_LIGHT }}
                  >
                    OK
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-sm font-semibold truncate" style={{ color: T.ink }}>
                    {t.name}
                  </div>
                  {t.players && (
                    <div className="text-xs truncate" style={{ color: T.inkDim }}>
                      {t.players}
                    </div>
                  )}
                </>
              )}
              {t.codigo && (
                <div className="text-xs font-mono mt-0.5" style={{ color: T.inkDim }}>
                  🔑 {t.codigo}
                </div>
              )}
            </div>
            <button
              onClick={() => onSetMetodoPago(t.id, siguienteMetodo(t.metodo_pago))}
              className="text-xs px-2 py-1 rounded-full font-bold transition-colors duration-200 flex-shrink-0"
              style={
                t.metodo_pago === "efectivo"
                  ? { background: T.gold, color: INK_ON_LIGHT, border: `1px solid ${T.gold}` }
                  : t.metodo_pago === "transferencia"
                  ? { background: T.redDim, color: "#FFFFFF", border: `1px solid ${T.redDim}` }
                  : { background: "transparent", color: T.inkDim, border: `1px solid ${T.gold}` }
              }
            >
              {t.metodo_pago === "efectivo" ? "Efectivo" : t.metodo_pago === "transferencia" ? "Transf." : "Debe"}
            </button>
            {editable && (onEditName || onEditPlayers) && editandoId !== t.id && (
              <button
                onClick={() => empezarEdicion(t)}
                title="Editar equipo"
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
                    Confirmar
                  </button>
                  <button onClick={() => setConfirmarBorrar(null)} className="text-xs px-1.5" style={{ color: T.inkDim }}>
                    No
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
