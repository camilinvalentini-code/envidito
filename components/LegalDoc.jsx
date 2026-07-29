"use client";
import React from "react";
import Link from "next/link";
import { useTheme } from "../lib/theme";
import ThemeToggleButton from "./ThemeToggleButton";

// body de cada sección: string = párrafo, { list: [...] } = lista con viñetas
export default function LegalDoc({ title, lastUpdated, sections }) {
  const { T } = useTheme();
  return (
    <div className="min-h-screen transition-colors duration-500" style={{ background: T.bg }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex justify-between mb-5">
          <Link href="/" className="text-xs underline" style={{ color: T.inkDim }}>
            ← Inicio
          </Link>
          <ThemeToggleButton />
        </div>
        <h1 className="text-2xl font-black text-center mb-1" style={{ color: T.ink, fontFamily: "Georgia, serif" }}>
          {title}
        </h1>
        <p className="text-center text-xs mb-8" style={{ color: T.inkDim }}>
          Última actualización: {lastUpdated}
        </p>

        {sections.map((s) => (
          <section key={s.n} className="mb-6">
            <h2 className="font-bold text-sm mb-2" style={{ color: T.gold }}>
              {s.n}. {s.title}
            </h2>
            {s.body.map((item, i) =>
              typeof item === "string" ? (
                <p key={i} className="text-sm leading-relaxed mb-2" style={{ color: T.ink }}>
                  {item}
                </p>
              ) : (
                <ul key={i} className="list-disc pl-5 mb-2">
                  {item.list.map((li, j) => (
                    <li key={j} className="text-sm leading-relaxed mb-1" style={{ color: T.ink }}>
                      {li}
                    </li>
                  ))}
                </ul>
              )
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
