# Torneo de Truco

Organizá torneos de truco sin lápiz ni papel. Armás el cuadro, sorteás, y cada mesa anota sus propios puntos desde el celular. El cuadro se completa solo hasta el campeón.

🔗 **torneotruco.com.ar**

## Qué tiene

- 1v1, 2v2 y 3v3.
- Tanteador a 15, 18, 20, 24, 30 o 40 puntos, para truco argentino y uruguayo.
- Sorteo automático, con repechaje opcional o el formato "Vidon Bar" (los que pierden van rellenando el cuadro hasta completarlo, sin llave aparte).
- Cada equipo elige su propio nombre desde "¿Cuál es tu equipo?" y siempre encuentra ahí su próximo partido, sin tener que preguntarle al organizador.
- Cada equipo tiene un código propio: hace falta para anotar puntos en sus partidos, así nadie de afuera puede tocar un resultado.
- Cruces listos para compartir por WhatsApp, incluso solo los nuevos que van apareciendo durante el torneo.
- Historial de campeones.
- Modo claro/oscuro y varios estilos de tanteador para elegir.
- Anotador libre en `/anotador`, para un partido suelto sin armar torneo.
- Link corto por organizador (`torneotruco.com.ar/t/tu-nombre`), que siempre apunta a tu torneo más reciente.
- Cada organizador entra con su email, sin contraseña la primera vez, y después puede configurar una para compartir la cuenta entre varios celus del mismo bar.

## Cómo se usa

1. Te registrás como organizador, creás el torneo.
2. Cargás los equipos, tocás sortear. A cada equipo le das su código (aparece al lado del nombre en el panel).
3. Cada equipo elige su nombre en "¿Cuál es tu equipo?" y anota con su código.
4. El cuadro se arma solo hasta el campeón, cualquiera lo puede seguir en vivo sin que le compartas nada.

## Para levantarlo de cero

Next.js + Supabase. Las variables de entorno necesarias están en `.env.example`. Deploy en Vercel.

Los `.sql` de este repo se corren en el SQL Editor de Supabase. Empezá por `supabase-schema.sql`, seguí con `supabase-schema-v2-roles.sql` y `supabase-schema-v3-jugadores.sql`, y después el resto de los `supabase-patch-*.sql` — cada uno lleva el nombre de lo que agrega o arregla.

---
🎴 Instagram: [@truco.cordoba](https://instagram.com/truco.cordoba)
