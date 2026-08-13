// CSP explicada: 'unsafe-inline' en script-src/style-src hace falta porque
// Next.js inyecta su propio script de hidratación inline, y toda la app
// usa style={{...}} de React (que compila a atributos style="" inline) en
// vez de clases — sin esto se rompería el sitio entero, no es un descuido.
// Igual bloquea lo importante: nada de terceros pueden inyectar <script>
// ni <iframe> ajenos, y frame-ancestors 'none' impide el clickjacking.
//
// 'unsafe-eval' solo en desarrollo: el Fast Refresh de "next dev" evalúa
// código con eval() para recargar en caliente — en el build de producción
// (lo que corre en Vercel) no hace falta, así que ahí queda afuera.
const esDev = process.env.NODE_ENV === "development";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};
export default nextConfig;
