"use client";
import React from "react";
import Link from "next/link";
import { useTheme } from "../lib/theme";

export default function SiteFooter() {
  const { T } = useTheme();
  return (
    <footer className="max-w-3xl mx-auto px-4 pb-10 pt-6 text-center" style={{ background: T.bg }}>
      <a
        href="https://instagram.com/torneos.envidito"
        target="_blank"
        rel="noreferrer"
        className="block text-sm font-semibold mb-2"
        style={{ color: T.inkDim }}
      >
        📸 @torneos.envidito
      </a>
      <div className="flex items-center justify-center gap-3 mb-2 text-xs">
        <Link href="/terminos-y-condiciones" className="underline" style={{ color: T.inkDim }}>
          Términos y Condiciones
        </Link>
        <span style={{ color: T.inkDim }}>·</span>
        <Link href="/politica-de-privacidad" className="underline" style={{ color: T.inkDim }}>
          Política de Privacidad
        </Link>
        <span style={{ color: T.inkDim }}>·</span>
        <a href="mailto:torneotruco.cba+envidito@gmail.com" className="underline" style={{ color: T.inkDim }}>
          Contacto
        </a>
      </div>
      <p className="text-xs" style={{ color: T.inkDim }}>
        Si te sirvió, una colaboración se agradece — alias{" "}
        <span className="font-bold" style={{ color: T.goldBright }}>
          Envidito
        </span>
      </p>
    </footer>
  );
}
