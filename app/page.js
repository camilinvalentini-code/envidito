"use client";
import Link from "next/link";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/useAuth";
import ThemeToggleButton from "../components/ThemeToggleButton";
import { IconEspada, IconBasto, IconOro, IconCopa, IconDoc, IconOjo, IconEstrella, IconAnotador } from "../components/LineIcons";

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
    <div className="transition-colors duration-500" style={{ background: T.bg }}>
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
