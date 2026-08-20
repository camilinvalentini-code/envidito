"use client";
import React from "react";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Nada de <input type="date">: el widget nativo muestra el orden
// día/mes según el idioma del SISTEMA del celular, no el de la página
// (Safari/iOS en particular ignora el atributo lang del input). Con 3
// campos explícitos — día, mes por nombre, año — no hay forma de
// confundir cuál es cuál, en ningún dispositivo.
function partes(value) {
  if (!value) return { dia: "", mes: "", anio: "" };
  const [anio, mes, dia] = value.split("-");
  return {
    dia: dia ? String(parseInt(dia, 10)) : "",
    mes: mes ? String(parseInt(mes, 10)) : "",
    anio: anio || "",
  };
}

export default function FechaNacimientoInput({ T, value, onChange }) {
  const { dia, mes, anio } = partes(value);

  function emitir(nuevoDia, nuevoMes, nuevoAnio) {
    if (nuevoDia && nuevoMes && nuevoAnio && String(nuevoAnio).length === 4) {
      onChange(`${nuevoAnio}-${String(nuevoMes).padStart(2, "0")}-${String(nuevoDia).padStart(2, "0")}`);
    } else {
      onChange("");
    }
  }

  const estilo = { background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` };

  return (
    <div className="grid grid-cols-3 gap-2">
      <select value={dia} onChange={(e) => emitir(e.target.value, mes, anio)} className="px-2 py-2 rounded-lg text-sm" style={estilo}>
        <option value="">Día</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select value={mes} onChange={(e) => emitir(dia, e.target.value, anio)} className="px-2 py-2 rounded-lg text-sm" style={estilo}>
        <option value="">Mes</option>
        {MESES.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      <input
        value={anio}
        onChange={(e) => emitir(dia, mes, e.target.value.replace(/\D/g, "").slice(0, 4))}
        type="text"
        inputMode="numeric"
        placeholder="Año"
        maxLength={4}
        className="px-2 py-2 rounded-lg text-sm"
        style={estilo}
      />
    </div>
  );
}
