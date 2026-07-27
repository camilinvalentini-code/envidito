import PresentacionClient from "./PresentacionClient";

export const metadata = {
  title: "Torneo de Truco — presentación",
  description: "Organizá torneos de truco en tu bar. Sorteo automático, cuadro en vivo, anotador por código.",
};

export default function PresentacionPage() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />
      <PresentacionClient />
    </>
  );
}
