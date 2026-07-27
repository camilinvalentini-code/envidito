"use client";

import { useEffect } from "react";

const CSS = `
  :root{
    --ink:#111111;
    --gray:#6B7280;
    --gray-light:#9CA3AF;
    --green:#16A34A;
    --green-bright:#22C55E;
    --line:#E5E7EB;
    --bg:#FFFFFF;
    --sans:'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  #presentacion-root *{margin:0;padding:0;box-sizing:border-box;}
  #presentacion-root{
    background:var(--bg);
    color:var(--ink);
    font-family:var(--sans);
    overflow-x:hidden;
  }
  html:has(#presentacion-root){ scroll-behavior:smooth; }

  #presentacion-root section{
    position:relative;
    min-height:100vh;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:100px 24px;
    text-align:center;
    border-bottom:1px solid var(--line);
  }
  #presentacion-root section:last-child{ border-bottom:none; }

  #presentacion-root .eyebrow{
    font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase;
    color:var(--green); margin-bottom:20px;
  }
  #presentacion-root h1{
    font-weight:900; font-size:clamp(42px,8vw,96px);
    line-height:1.03; letter-spacing:-0.03em; max-width:16ch;
  }
  #presentacion-root h2{
    font-weight:800; font-size:clamp(30px,5vw,54px);
    line-height:1.08; letter-spacing:-0.02em; max-width:16ch;
  }
  #presentacion-root .sub{
    font-size:clamp(16px,1.8vw,21px); color:var(--gray); max-width:38ch;
    line-height:1.55; margin-top:18px; font-weight:500;
  }
  #presentacion-root .domain{
    font-size:clamp(15px,1.6vw,18px); color:var(--ink); font-weight:700;
    margin-top:30px; text-decoration:none; border-bottom:2px solid var(--green); padding-bottom:2px;
  }

  #presentacion-root .reveal{ opacity:1; transform:none; transition:opacity .7s ease, transform .7s ease; }
  #presentacion-root.js-ready .reveal{ opacity:0; transform:translateY(24px); }
  #presentacion-root.js-ready .reveal.on{ opacity:1; transform:translateY(0); }
  #presentacion-root .reveal.d1{ transition-delay:.08s; } #presentacion-root .reveal.d2{ transition-delay:.16s; }
  #presentacion-root .reveal.d3{ transition-delay:.24s; } #presentacion-root .reveal.d4{ transition-delay:.32s; }

  #presentacion-root #hero .sub{ margin-top:22px; }
  #presentacion-root #hero .domain{ margin-top:44px; }

  #presentacion-root .grid-4{
    display:grid; grid-template-columns:repeat(2,1fr); gap:36px 48px;
    margin-top:56px; max-width:640px; width:100%; text-align:left;
  }
  @media (max-width:640px){ #presentacion-root .grid-4{ grid-template-columns:1fr; max-width:380px; } }
  #presentacion-root .prob-item strong{ display:block; font-size:18px; font-weight:700; margin-bottom:6px; }
  #presentacion-root .prob-item span{ font-size:14.5px; color:var(--gray); line-height:1.5; }

  #presentacion-root .steps-row{
    display:flex; align-items:center; gap:20px; margin-top:56px; flex-wrap:wrap; justify-content:center;
  }
  #presentacion-root .step-card{
    width:190px; padding:28px 20px; border:1px solid var(--line); border-radius:16px; text-align:left;
  }
  #presentacion-root .step-num{
    font-size:12px; font-weight:800; color:var(--green); margin-bottom:12px;
  }
  #presentacion-root .step-card strong{ display:block; font-size:16.5px; font-weight:700; margin-bottom:5px; }
  #presentacion-root .step-card span{ font-size:13.5px; color:var(--gray); line-height:1.5; }
  #presentacion-root .step-arrow{ font-size:20px; color:var(--gray-light); font-weight:300; }
  @media (max-width:760px){ #presentacion-root .step-arrow{ transform:rotate(90deg); } }
  #presentacion-root .badges-row{
    display:flex; gap:14px; flex-wrap:wrap; justify-content:center; margin-top:52px;
  }
  #presentacion-root .badge{
    font-size:13px; font-weight:700; letter-spacing:.02em;
    padding:10px 18px; border-radius:999px; background:#F0FDF4; color:var(--green);
  }

  #presentacion-root .mock-score{
    margin-top:48px; border:1px solid var(--line); border-radius:20px; padding:32px 44px;
    display:flex; align-items:center; gap:40px;
  }
  #presentacion-root .mock-team{ text-align:center; }
  #presentacion-root .mock-team .name{ font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--gray); margin-bottom:10px; }
  #presentacion-root .mock-team .score{ font-size:44px; font-weight:900; }
  #presentacion-root .mock-sep{ width:1px; height:56px; background:var(--line); }
  #presentacion-root .mock-caption{ margin-top:16px; font-size:12.5px; color:var(--gray-light); font-weight:600; }
  #presentacion-root .anotador-text{ max-width:36ch; margin-top:18px; }
  #presentacion-root .anotador-text p{ font-size:14.5px; color:var(--gray); line-height:1.6; }
  #presentacion-root .anotador-text p + p{ margin-top:10px; }
  #presentacion-root .anotador-text b{ color:var(--ink); }

  #presentacion-root .bracket{ margin-top:52px; display:flex; flex-direction:column; align-items:center; gap:14px; }
  #presentacion-root .bracket-row{ display:flex; gap:14px; align-items:center; flex-wrap:wrap; justify-content:center; }
  #presentacion-root .bracket-pair{
    display:flex; flex-direction:column; border:1px solid var(--line); border-radius:12px; overflow:hidden; width:170px;
  }
  #presentacion-root .bracket-pair span{ padding:10px 14px; font-size:13.5px; font-weight:600; text-align:left; }
  #presentacion-root .bracket-pair span:first-child{ border-bottom:1px solid var(--line); }
  #presentacion-root .bracket-vs{ font-size:11px; color:var(--gray-light); font-weight:700; }
  #presentacion-root .bracket-down{ font-size:18px; color:var(--gray-light); }
  #presentacion-root .bracket-winner{
    display:flex; align-items:center; gap:8px; font-size:19px; font-weight:800; margin-top:4px;
  }
  #presentacion-root .live-dot{
    display:inline-flex; align-items:center; gap:8px; margin-top:22px;
    font-size:12px; font-weight:800; letter-spacing:.1em; color:var(--green);
  }
  #presentacion-root .live-dot i{
    width:8px; height:8px; border-radius:50%; background:var(--green-bright);
    animation:pt-blink 1.6s ease-in-out infinite;
  }
  @keyframes pt-blink{ 0%,100%{opacity:1;} 50%{opacity:.25;} }

  #presentacion-root .quote-solved{
    margin-top:40px; display:inline-flex; align-items:center; gap:12px; flex-wrap:wrap; justify-content:center;
  }
  #presentacion-root .quote-solved span{
    font-size:17px; font-style:italic; color:var(--gray-light); text-decoration:line-through; text-decoration-thickness:1.5px;
  }
  #presentacion-root .solved-tag{
    font-size:12px; font-weight:800; color:var(--green); background:#F0FDF4; padding:6px 12px; border-radius:999px;
  }

  #presentacion-root .chip-group{ margin-top:44px; }
  #presentacion-root .chip-group-label{ font-size:12px; font-weight:700; color:var(--gray-light); text-transform:uppercase; letter-spacing:.1em; margin-bottom:12px; }
  #presentacion-root .chips{ display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-bottom:32px; }
  #presentacion-root .chip{
    font-size:14px; font-weight:700; padding:9px 18px; border-radius:999px; border:1px solid var(--line); color:var(--ink);
  }
  #presentacion-root .config-close{ font-size:19px; font-weight:800; margin-top:16px; max-width:22ch; }

  #presentacion-root .benef-list{
    display:flex; flex-direction:column; gap:0; margin-top:48px; max-width:420px; width:100%; text-align:left;
  }
  #presentacion-root .benef-item{
    display:flex; align-items:center; gap:14px; padding:16px 4px; border-bottom:1px solid var(--line); font-size:16.5px; font-weight:600;
  }
  #presentacion-root .benef-item:first-child{ border-top:1px solid var(--line); }
  #presentacion-root .benef-check{ color:var(--green); font-weight:900; font-size:16px; }
  #presentacion-root .price{ font-size:clamp(56px,10vw,110px); font-weight:900; color:var(--green); margin-top:60px; line-height:1; }
  #presentacion-root .price-caption{ font-size:13px; font-weight:700; color:var(--gray-light); text-transform:uppercase; letter-spacing:.08em; margin-top:10px; }
  #presentacion-root .price-fine{ font-size:13.5px; color:var(--gray); margin-top:22px; }

  #presentacion-root #close .sub{ margin-top:16px; }
  #presentacion-root .close-links{ margin-top:34px; display:flex; flex-direction:column; gap:10px; align-items:center; }
  #presentacion-root .close-links a{ color:var(--gray); text-decoration:none; font-size:14px; font-weight:600; }
  #presentacion-root .close-links a:hover{ color:var(--green); }

  #presentacion-root .dotnav{
    position:fixed; right:22px; top:50%; transform:translateY(-50%); z-index:5;
    display:flex; flex-direction:column; gap:12px;
  }
  #presentacion-root .dotnav button{
    width:7px; height:7px; border-radius:50%; border:1px solid var(--gray-light);
    background:transparent; cursor:pointer; padding:0; transition:background .3s ease, transform .3s ease;
  }
  #presentacion-root .dotnav button.active{ background:var(--green); border-color:var(--green); transform:scale(1.35); }
  @media (max-width:640px){ #presentacion-root .dotnav{ display:none; } }

  @media (prefers-reduced-motion: reduce){
    #presentacion-root *{ animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; }
  }
`;

const SECTIONS = ["hero", "problema", "solucion", "anotador", "cuadro", "jugador", "config", "beneficios", "close"];

export default function PresentacionClient() {
  useEffect(() => {
    const root = document.getElementById("presentacion-root");
    if (!root) return;
    root.classList.add("js-ready");

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("on");
        });
      },
      { threshold: 0.2 }
    );
    root.querySelectorAll(".reveal").forEach((el) => io.observe(el));

    const dots = root.querySelectorAll("#dotnav button");
    const dotHandlers = [];
    dots.forEach((d) => {
      const handler = () => {
        document.getElementById(d.dataset.target)?.scrollIntoView({ behavior: "smooth" });
      };
      dotHandlers.push([d, handler]);
      d.addEventListener("click", handler);
    });
    const sections = SECTIONS.map((id) => document.getElementById(id)).filter(Boolean);
    const io2 = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = sections.indexOf(e.target);
            dots.forEach((d) => d.classList.remove("active"));
            if (dots[idx]) dots[idx].classList.add("active");
          }
        });
      },
      { threshold: 0.5 }
    );
    sections.forEach((s) => io2.observe(s));

    return () => {
      io.disconnect();
      io2.disconnect();
      dotHandlers.forEach(([d, handler]) => d.removeEventListener("click", handler));
    };
  }, []);

  return (
    <div id="presentacion-root">
      <style>{CSS}</style>

      <nav className="dotnav" id="dotnav">
        {SECTIONS.map((id, i) => (
          <button key={id} data-target={id} className={i === 0 ? "active" : ""}></button>
        ))}
      </nav>

      <section id="hero">
        <h1>Torneo de Truco</h1>
        <p className="sub">Organizá torneos de truco en tu bar.</p>
        <a className="domain" href="https://torneotruco.com.ar" target="_blank" rel="noreferrer">
          torneotruco.com.ar
        </a>
      </section>

      <section id="problema">
        <div className="eyebrow">El problema</div>
        <h2 className="reveal">Organizar a mano es un quilombo</h2>
        <div className="grid-4">
          <div className="prob-item reveal d1">
            <strong>Anotar en papel</strong>
            <span>se pierde, se mancha, no lo ve nadie más que vos.</span>
          </div>
          <div className="prob-item reveal d2">
            <strong>Gritar los cruces</strong>
            <span>medio bar preguntando quién juega contra quién.</span>
          </div>
          <div className="prob-item reveal d3">
            <strong>Discusiones por el conteo</strong>
            <span>nadie se pone de acuerdo en qué marcaba el papelito.</span>
          </div>
          <div className="prob-item reveal d4">
            <strong>El organizador corre toda la noche</strong>
            <span>de mesa en mesa, sin parar un segundo.</span>
          </div>
        </div>
      </section>

      <section id="solucion">
        <div className="eyebrow">La solución</div>
        <h2 className="reveal">El torneo se maneja solo</h2>
        <div className="steps-row">
          <div className="step-card reveal d1">
            <div className="step-num">PASO 1</div>
            <strong>Cargás los equipos</strong>
            <span>solo nombres.</span>
          </div>
          <div className="step-arrow reveal d2">→</div>
          <div className="step-card reveal d2">
            <div className="step-num">PASO 2</div>
            <strong>Sorteo automático</strong>
            <span>la web arma el cuadro.</span>
          </div>
          <div className="step-arrow reveal d3">→</div>
          <div className="step-card reveal d3">
            <div className="step-num">PASO 3</div>
            <strong>El torneo se maneja solo</strong>
            <span>vos atendés el bar.</span>
          </div>
        </div>
        <div className="badges-row reveal d4">
          <span className="badge">GRATIS</span>
          <span className="badge">SIN INSTALAR NADA</span>
          <span className="badge">SIN CREAR CUENTA</span>
        </div>
      </section>

      <section id="anotador">
        <div className="eyebrow">El anotador</div>
        <h2 className="reveal">Cada mesa, su anotador</h2>
        <p className="sub reveal d1">Marcador digital, look tradicional.</p>

        <div className="mock-score reveal d2">
          <div className="mock-team">
            <div className="name">Nosotros</div>
            <div className="score">7</div>
          </div>
          <div className="mock-sep"></div>
          <div className="mock-team">
            <div className="name">Ellos</div>
            <div className="score">5</div>
          </div>
        </div>
        <div className="mock-caption reveal d2">a 30 puntos</div>

        <div className="anotador-text reveal d3">
          <p>
            El contador usa <b>fósforos y palitos</b>, como el truco de verdad.
          </p>
          <p>
            Cada equipo tiene su <b>código secreto</b> — solo los dos que juegan pueden cargar el resultado. Eso
            elimina discusiones.
          </p>
        </div>
      </section>

      <section id="cuadro">
        <div className="eyebrow">El cuadro</div>
        <h2 className="reveal">El cuadro, en vivo</h2>
        <p className="sub reveal d1">Se ve desde cualquier celular, o en una pantalla del bar. Se actualiza solo.</p>

        <div className="bracket reveal d2">
          <div className="bracket-row">
            <div className="bracket-pair">
              <span>Jenni y Braian</span>
              <span>Las Winx</span>
            </div>
            <div className="bracket-vs">VS</div>
            <div className="bracket-pair">
              <span>Los Mentirosos</span>
              <span>Rio Platenses</span>
            </div>
          </div>
          <div className="bracket-down">↓</div>
          <div className="bracket-winner">🏆 Rio Platenses</div>
          <div className="live-dot">
            <i></i>EN VIVO
          </div>
        </div>
      </section>

      <section id="jugador">
        <div className="eyebrow">Para el jugador</div>
        <h2 className="reveal">Decís tu equipo una vez, listo</h2>
        <p className="sub reveal d1">
          Después, la plataforma encuentra sola tu próximo partido — sin tener que preguntarle todo al organizador.
        </p>
        <div className="quote-solved reveal d2">
          <span>"¿y ahora contra quién jugamos?"</span>
          <span className="solved-tag">✓ resuelto</span>
        </div>
      </section>

      <section id="config">
        <div className="eyebrow">Configuración</div>
        <h2 className="reveal">Se adapta a tu torneo</h2>

        <div className="chip-group reveal d1">
          <div className="chip-group-label">Reglamento</div>
          <div className="chips">
            <span className="chip">Argentina</span>
            <span className="chip">Uruguay</span>
          </div>
        </div>
        <div className="chip-group reveal d2">
          <div className="chip-group-label">Puntaje</div>
          <div className="chips">
            <span className="chip">15</span>
            <span className="chip">18</span>
            <span className="chip">20</span>
            <span className="chip">24</span>
            <span className="chip">30</span>
            <span className="chip">40</span>
          </div>
        </div>
        <div className="chip-group reveal d3">
          <div className="chip-group-label">Modalidad</div>
          <div className="chips">
            <span className="chip">1 vs 1</span>
            <span className="chip">2 vs 2</span>
            <span className="chip">3 vs 3</span>
          </div>
        </div>
        <p className="config-close reveal d4">La plataforma se adapta al torneo, no al revés.</p>
      </section>

      <section id="beneficios">
        <div className="eyebrow">Para el bar</div>
        <h2 className="reveal">Qué gana el bar</h2>
        <div className="benef-list">
          <div className="benef-item reveal d1">
            <span className="benef-check">✓</span>Más gente
          </div>
          <div className="benef-item reveal d1">
            <span className="benef-check">✓</span>Más tiempo consumiendo
          </div>
          <div className="benef-item reveal d2">
            <span className="benef-check">✓</span>Menos trabajo para el personal
          </div>
          <div className="benef-item reveal d2">
            <span className="benef-check">✓</span>Imagen moderna
          </div>
        </div>
        <div className="price reveal d3">$0</div>
        <div className="price-caption reveal d3">Costo para el bar</div>
        <p className="price-fine reveal d4">Sin licencias. Sin abonos. Sin letra chica.</p>
      </section>

      <section id="close">
        <h2>Probalo en tu próximo torneo</h2>
        <a className="domain" href="https://torneotruco.com.ar" target="_blank" rel="noreferrer">
          torneotruco.com.ar
        </a>
        <p className="sub">Armamos tu primer torneo juntos, sin costo y sin compromiso.</p>
        <div className="close-links">
          <a href="https://instagram.com/truco.cordoba" target="_blank" rel="noreferrer">
            @truco.cordoba
          </a>
        </div>
      </section>
    </div>
  );
}
