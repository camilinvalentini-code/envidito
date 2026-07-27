import PresentacionClient from "./PresentacionClient";

export const metadata = {
  title: "Torneo de Truco — presentación",
  description: "Organizá torneos de truco en tu bar. Sorteo automático, cuadro en vivo, anotador por código.",
  openGraph: {
    title: "Torneo de Truco — presentación",
    description: "Organizá torneos de truco en tu bar. Sorteo automático, cuadro en vivo, anotador por código.",
    url: "https://torneotruco.com.ar/presentacion",
    siteName: "Torneo de Truco",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Torneo de Truco — presentación",
    description: "Organizá torneos de truco en tu bar. Sorteo automático, cuadro en vivo, anotador por código.",
    images: ["/og-image.png"],
  },
};

export default function PresentacionPage() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,600&family=Manrope:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap"
        rel="stylesheet"
      />
      <PresentacionClient />
    </>
  );
}
