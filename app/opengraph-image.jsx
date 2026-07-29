import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Envidito";
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
          background: "#152420",
          backgroundImage:
            "radial-gradient(circle at 20% 15%, rgba(227,181,99,0.18), transparent 60%), radial-gradient(circle at 85% 75%, rgba(227,181,99,0.10), transparent 60%)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 120,
            fontWeight: 800,
            color: "#EDE6D6",
            letterSpacing: "-2px",
          }}
        >
          Envidito
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "22px",
            fontSize: 30,
            color: "#93A69B",
          }}
        >
          El torneo se arma solo. Vos atendés el bar.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "44px",
            fontSize: 24,
            fontWeight: 700,
            color: "#152420",
            background: "#E3B563",
            padding: "14px 36px",
            borderRadius: "999px",
          }}
        >
          envidito.com
        </div>
      </div>
    ),
    { ...size }
  );
}
