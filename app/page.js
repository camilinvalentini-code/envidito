"use client";
import Link from "next/link";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/useAuth";
import ThemeToggleButton from "../components/ThemeToggleButton";

function IconEspada({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <line x1="10" y1="2" x2="10" y2="14" stroke={color} strokeWidth="1.6" />
      <line x1="5.5" y1="6" x2="14.5" y2="6" stroke={color} strokeWidth="1.6" />
      <path d="M8 14H12L10 18L8 14Z" fill={color} />
    </svg>
  );
}
function IconBasto({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <line x1="5" y1="16" x2="15" y2="4" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="6" cy="15" r="1.9" fill={color} />
      <circle cx="14" cy="5" r="1.9" fill={color} />
    </svg>
  );
}
function IconOro({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke={color} strokeWidth="1.5" />
      <circle cx="10" cy="10" r="2.9" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}
function IconCopa({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 3H16L13.2 10.5C12.5 12.3 11 13 10 13C9 13 7.5 12.3 6.8 10.5L4 3Z"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <line x1="10" y1="13" x2="10" y2="16.5" stroke={color} strokeWidth="1.4" />
      <line x1="6.5" y1="17.5" x2="13.5" y2="17.5" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}
function IconDoc({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2" width="14" height="16" rx="2.5" stroke={color} strokeWidth="1.6" />
      <line x1="7" y1="6" x2="13" y2="6" stroke={color} strokeWidth="1.4" />
      <line x1="7" y1="9.5" x2="13" y2="9.5" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}
function IconOjo({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.6" />
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}
function IconEstrella({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2l2.6 6.6L21 9l-5 4.6L17.3 21 12 17.3 6.7 21 8 13.6 3 9l6.4-.4z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconAnotador({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="2.5" stroke={color} strokeWidth="1.5" />
      <line x1="8" y1="8" x2="16" y2="8" stroke={color} strokeWidth="1.4" />
      <line x1="8" y1="12" x2="16" y2="12" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

function SecondaryLink({ href, icon, label, T }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 py-3 px-4 rounded-2xl text-sm font-bold mb-2.5 transition-all duration-200 hover:scale-105 active:scale-95"
      style={{ background: T.panel, color: T.ink, border: `1px solid ${T.line}` }}
    >
      {icon}
      {label}
    </Link>
  );
}

export default function Home() {
  const { T } = useTheme();
  const { session, profile, loading } = useAuth();

  const panelHref = profile?.role === "admin" ? "/admin/panel" : "/organizador/panel";

  return (
    <div className="min-h-screen transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-md mx-auto px-4 py-10">
        <div className="flex justify-end mb-4">
          <ThemeToggleButton />
        </div>
        <div className="flex items-center gap-2.5 justify-center mb-2">
          <IconEspada color={T.goldBright} />
          <IconBasto color={T.goldBright} />
          <IconOro color={T.goldBright} />
          <IconCopa color={T.goldBright} />
        </div>
        <h1
          className="text-3xl font-black text-center tracking-tight mb-2"
          style={{ color: T.ink, fontFamily: "Georgia, serif" }}
        >
          Envidito
        </h1>
        <p className="text-center text-sm mb-8" style={{ color: T.inkDim }}>
          Armá el cuadro, sorteá, y que cada mesa cargue sus propios puntos desde el celular.
        </p>

        {!loading && session && (
          <Link
            href={panelHref}
            className="flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-lg mb-3 transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`,
              color: T.ink,
              boxShadow: `0 6px 16px ${T.gold}66`,
            }}
          >
            <IconDoc color={T.ink} />
            Ir a mi panel
          </Link>
        )}
        {!loading && !session && (
          <Link
            href="/organizador/acceso"
            className="flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-lg mb-3 transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: `linear-gradient(180deg, ${T.goldBright}, ${T.gold})`,
              color: T.ink,
              boxShadow: `0 6px 16px ${T.gold}66`,
            }}
          >
            <IconDoc color={T.ink} />
            Soy organizador, quiero entrar
          </Link>
        )}

        <SecondaryLink href="/en-vivo" icon={<IconOjo color={T.ink} />} label="Ver torneos en vivo" T={T} />
        <SecondaryLink href="/historial" icon={<IconEstrella color={T.ink} />} label="Ver historial de campeones" T={T} />
        <SecondaryLink href="/anotador" icon={<IconAnotador color={T.ink} />} label="Anotador libre" T={T} />

        <Link
          href="/presentacion"
          className="block text-center mt-6 text-xs font-semibold underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity duration-200"
          style={{ color: T.inkDim }}
        >
          ¿Qué es esto? Ver presentación →
        </Link>
      </div>
    </div>
  );
}
