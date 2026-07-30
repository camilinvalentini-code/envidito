"use client";
import React from "react";
import { useTheme } from "../lib/theme";
import { IconSol, IconLuna } from "./LineIcons";

export default function ThemeToggleButton() {
  const { theme, T, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold transition-all duration-200 hover:scale-105 active:scale-95"
      style={{ background: T.panel, color: T.ink, border: `1px solid ${T.line}` }}
    >
      {theme === "dark" ? <IconSol color={T.ink} /> : <IconLuna color={T.ink} />}
      {theme === "dark" ? "Modo día" : "Modo oscuro"}
    </button>
  );
}
