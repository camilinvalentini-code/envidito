import "./globals.css";
import { ThemeProvider } from "../lib/theme";
import ConditionalFooter from "../components/ConditionalFooter";
import RotatingFavicon from "../components/RotatingFavicon";

export const metadata = {
  metadataBase: new URL("https://www.envidito.com"),
  title: "Envidito",
  description: "Organizá torneos de truco 2v2 y 3v3: sorteo automático, cuadro en vivo, anotador por mesa y repechaje.",
  icons: { icon: "/favicon.png" },
  openGraph: {
    title: "Envidito",
    description: "El torneo se arma solo. Sorteo automático, cuadro en vivo, anotador en cada mesa.",
    url: "https://www.envidito.com",
    siteName: "Envidito",
    locale: "es_AR",
    type: "website",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Envidito",
    description: "El torneo se arma solo. Sorteo automático, cuadro en vivo, anotador en cada mesa.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <RotatingFavicon />
        <ThemeProvider>
          <div className="min-h-screen flex flex-col">
            <div className="flex-1">{children}</div>
            <ConditionalFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
