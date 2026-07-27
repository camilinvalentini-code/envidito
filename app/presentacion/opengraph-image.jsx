import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Torneo de Truco — presentación";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0E2A20",
          backgroundImage:
            "radial-gradient(circle at 20% 15%, rgba(212,169,78,0.20), transparent 60%), radial-gradient(circle at 85% 75%, rgba(193,89,79,0.16), transparent 60%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 22,
            letterSpacing: "6px",
            textTransform: "uppercase",
            color: "#D4A94E",
            marginBottom: "26px",
          }}
        >
          Para organizadores de truco
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 110,
            fontWeight: 800,
            color: "#F3E8D2",
            letterSpacing: "-2px",
          }}
        >
          Torneo de Truco
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "26px",
            fontSize: 32,
            color: "#AFC0B4",
          }}
        >
          Organizá torneos de truco en tu bar
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "48px",
            fontSize: 26,
            fontWeight: 700,
            color: "#0E2A20",
            background: "#D4A94E",
            padding: "16px 40px",
            borderRadius: "999px",
          }}
        >
          torneotruco.com.ar
        </div>
      </div>
    ),
    { ...size }
  );
}
