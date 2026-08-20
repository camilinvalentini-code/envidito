"use client";
import React, { useEffect, useState } from "react";

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
  // Estado propio para los 3 campos: si se derivaran de "value" en cada
  // render, cada tecla en Año (mientras todavía no tiene 4 dígitos)
  // haría que el padre reciba "" y eso borraría día/mes también. Acá se
  // sincroniza desde afuera solo cuando "value" cambia de verdad (carga
  // inicial, o el padre resetea el formulario) — nunca en cada tecla.
  const [dia, setDia] = useState(() => partes(value).dia);
  const [mes, setMes] = useState(() => partes(value).mes);
  const [anio, setAnio] = useState(() => partes(value).anio);

  useEffect(() => {
    const p = partes(value);
    setDia(p.dia);
    setMes(p.mes);
    setAnio(p.anio);
  }, [value]);

  function actualizar(nuevoDia, nuevoMes, nuevoAnio) {
    setDia(nuevoDia);
    setMes(nuevoMes);
    setAnio(nuevoAnio);
    // Solo avisamos al padre cuando la fecha queda completa y válida —
    // mientras se está escribiendo, no tocamos su estado para no pisar
    // lo que la persona ya cargó en los otros campos.
    if (nuevoDia && nuevoMes && nuevoAnio && nuevoAnio.length === 4) {
      onChange(`${nuevoAnio}-${String(nuevoMes).padStart(2, "0")}-${String(nuevoDia).padStart(2, "0")}`);
    }
  }

  const estilo = { background: T.panelLight, color: T.ink, border: `1px solid ${T.line}` };

  return (
    <div className="grid grid-cols-3 gap-2">
      <select value={dia} onChange={(e) => actualizar(e.target.value, mes, anio)} className="px-2 py-2 rounded-lg text-sm" style={estilo}>
        <option value="">Día</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select value={mes} onChange={(e) => actualizar(dia, e.target.value, anio)} className="px-2 py-2 rounded-lg text-sm" style={estilo}>
        <option value="">Mes</option>
        {MESES.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      <input
        value={anio}
        onChange={(e) => actualizar(dia, mes, e.target.value.replace(/\D/g, "").slice(0, 4))}
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
