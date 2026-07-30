"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useTheme } from "../lib/theme";

const EMAIL_CONTACTO = "torneotruco.cba+envidito@gmail.com";

export default function SiteFooter() {
  const { T } = useTheme();
  const [copiado, setCopiado] = useState(false);

  async function copiarMail(e) {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(EMAIL_CONTACTO);
    } catch (err) {}
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
    window.location.href = `mailto:${EMAIL_CONTACTO}`;
  }

  const linkStyle = {
    color: T.inkDim,
    opacity: 0.75,
  };

  return (
    <footer className="max-w-3xl mx-auto px-4 pb-10 pt-8 text-center text-xs" style={{ color: T.inkDim }}>
      <a
        href="https://instagram.com/torneos.envidito"
        target="_blank"
        rel="noreferrer"
        className="block text-sm font-semibold mb-4 transition-opacity duration-200 hover:opacity-100"
        style={{ color: T.inkDim, opacity: 0.85 }}
      >
        📸 @torneos.envidito
      </a>
      <div className="flex items-center justify-center gap-2.5 flex-wrap mb-3">
        <Link href="/terminos-y-condiciones" className="transition-opacity duration-200 hover:opacity-100" style={linkStyle}>
          Términos y Condiciones
        </Link>
        <span style={{ ...linkStyle, opacity: 0.4 }}>·</span>
        <Link href="/politica-de-privacidad" className="transition-opacity duration-200 hover:opacity-100" style={linkStyle}>
          Política de Privacidad
        </Link>
        <span style={{ ...linkStyle, opacity: 0.4 }}>·</span>
        <a href={`mailto:${EMAIL_CONTACTO}`} onClick={copiarMail} className="transition-opacity duration-200 hover:opacity-100" style={linkStyle}>
          Contacto
        </a>
      </div>
      {copiado && (
        <p className="mb-3" style={{ color: T.goldBright }}>
          ¡Copiado! {EMAIL_CONTACTO}
        </p>
      )}
      <p>
        Si te sirvió, una colaboración se agradece — alias{" "}
        <span className="font-bold" style={{ color: T.goldBright }}>
          Envidito
        </span>
      </p>
    </footer>
  );
}
