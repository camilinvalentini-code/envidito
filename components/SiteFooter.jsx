"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useTheme } from "../lib/theme";

const EMAIL_CONTACTO = "torneotruco.cba+envidito@gmail.com";

export default function SiteFooter() {
  const { T } = useTheme();
  const [copiado, setCopiado] = useState(false);

  async function copiarMail() {
    try {
      await navigator.clipboard.writeText(EMAIL_CONTACTO);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {}
  }

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
        <a href={`mailto:${EMAIL_CONTACTO}`} onClick={copiarMail} className="underline" style={{ color: T.inkDim }}>
          Contacto
        </a>
      </div>
      <p className="text-xs mb-2" style={{ color: T.inkDim }}>
        {copiado ? "¡Copiado! " : ""}
        <span
          onClick={copiarMail}
          className="underline cursor-pointer"
          style={{ color: copiado ? T.goldBright : T.inkDim }}
        >
          {EMAIL_CONTACTO}
        </span>
      </p>
      <p className="text-xs" style={{ color: T.inkDim }}>
        Si te sirvió, una colaboración se agradece — alias{" "}
        <span className="font-bold" style={{ color: T.goldBright }}>
          Envidito
        </span>
      </p>
    </footer>
  );
}
