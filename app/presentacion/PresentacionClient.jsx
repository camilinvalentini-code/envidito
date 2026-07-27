"use client";

import { useEffect } from "react";

const CSS = `
  :root{
    --felt:#0E2A20;
    --felt-deep:#071812;
    --cream:#F3E8D2;
    --cream-dim:#AFC0B4;
    --gold:#D4A94E;
    --gold-bright:#EAC978;
    --rose:#C1594F;
    --line:rgba(212,169,78,0.25);
    --serif:'Fraunces', Georgia, serif;
    --sans:'Manrope', -apple-system, sans-serif;
    --mono:'Space Mono', monospace;
  }
  #presentacion-root *{margin:0;padding:0;box-sizing:border-box;}
  #presentacion-root{
    background:var(--felt);
    color:var(--cream);
    font-family:var(--sans);
    overflow-x:hidden;
  }
  html:has(#presentacion-root){ scroll-behavior:smooth; }
  #presentacion-root ::selection{background:var(--gold);color:var(--felt);}

  #presentacion-root .glow{
    position:fixed; inset:0; z-index:0; pointer-events:none;
    background:
      radial-gradient(600px 500px at 20% 15%, rgba(212,169,78,0.10), transparent 60%),
      radial-gradient(700px 600px at 85% 70%, rgba(193,89,79,0.08), transparent 60%);
    animation:pt-drift 22s ease-in-out infinite alternate;
  }
  @keyframes pt-drift{
    0%{ transform:translate(0,0); }
    100%{ transform:translate(-2%, 3%); }
  }

  #presentacion-root section{
    position:relative; z-index:1;
    min-height:100vh;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:80px 24px;
  }

  #presentacion-root .eyebrow{
    font-family:var(--mono); font-size:11px; letter-spacing:.22em; text-transform:uppercase;
    color:var(--gold); margin-bottom:18px; display:flex; align-items:center; gap:10px;
  }
  #presentacion-root .eyebrow::before{ content:''; width:22px; height:1px; background:var(--gold); display:inline-block; }

  #presentacion-root h1{
    font-family:var(--serif); font-weight:900; font-size:clamp(40px,7vw,86px);
    line-height:1.02; letter-spacing:-0.01em; max-width:14ch; text-align:center;
  }
  #presentacion-root h1 em{ font-style:italic; font-weight:600; color:var(--gold-bright); }
  #presentacion-root h2{
    font-family:var(--serif); font-weight:700; font-size:clamp(28px,4.2vw,48px);
    line-height:1.1; max-width:16ch; text-align:center;
  }
  #presentacion-root .sub{
    font-size:clamp(15px,1.6vw,19px); color:var(--cream-dim); max-width:46ch;
    text-align:center; line-height:1.65; margin-top:20px;
  }

  #presentacion-root .reveal{ opacity:1; transform:none; transition:opacity .8s ease, transform .8s ease; }
  #presentacion-root.js-ready .reveal{ opacity:0; transform:translateY(28px); }
  #presentacion-root.js-ready .reveal.on{ opacity:1; transform:translateY(0); }
  #presentacion-root .reveal.d1{ transition-delay:.08s; } #presentacion-root .reveal.d2{ transition-delay:.18s; }
  #presentacion-root .reveal.d3{ transition-delay:.28s; } #presentacion-root .reveal.d4{ transition-delay:.38s; } #presentacion-root .reveal.d5{ transition-delay:.48s; }
  #presentacion-root .reveal.d6{ transition-delay:.58s; }

  #presentacion-root #hero{ gap:0; }
  #presentacion-root .hero-cta{
    margin-top:38px; display:inline-flex; align-items:center; gap:10px;
    font-family:var(--mono); font-size:13px; letter-spacing:.05em;
    color:var(--felt); background:var(--gold); padding:15px 28px; border-radius:999px;
    text-decoration:none; font-weight:700;
    transition:transform .25s ease, background .25s ease, box-shadow .25s ease;
    box-shadow:0 0 0 rgba(212,169,78,0);
  }
  #presentacion-root .hero-cta:hover{ transform:translateY(-2px) scale(1.03); background:var(--gold-bright); box-shadow:0 10px 30px rgba(212,169,78,0.25);}

  #presentacion-root .scoreboard-demo{
    margin-top:64px; display:flex; gap:56px; align-items:flex-start;
  }
  #presentacion-root .sb-team{ text-align:center; }
  #presentacion-root .sb-name{ font-family:var(--mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--cream-dim); margin-bottom:14px; }
  #presentacion-root .sb-groups{ display:flex; gap:10px; }
  #presentacion-root .tally svg{ width:30px; height:30px; overflow:visible; }
  #presentacion-root .tally line{
    stroke:var(--gold-bright); stroke-width:2.6; stroke-linecap:round; fill:none;
    stroke-dasharray:1 1; stroke-dashoffset:1;
  }

  #presentacion-root .scroll-hint{
    position:absolute; bottom:38px; left:50%; transform:translateX(-50%);
    font-family:var(--mono); font-size:10px; letter-spacing:.2em; text-transform:uppercase;
    color:var(--cream-dim); display:flex; flex-direction:column; align-items:center; gap:8px;
    opacity:.7;
  }
  #presentacion-root .scroll-hint .stick{ width:1px; height:30px; background:linear-gradient(var(--gold), transparent); animation:pt-pulse 1.8s ease-in-out infinite; }
  @keyframes pt-pulse{ 0%,100%{opacity:.3;} 50%{opacity:1;} }

  #presentacion-root .feat-list{ margin-top:56px; display:flex; flex-direction:column; gap:0; width:100%; max-width:640px; }
  #presentacion-root .feat{
    display:flex; align-items:baseline; gap:24px; padding:26px 4px;
    border-bottom:1px solid var(--line);
  }
  #presentacion-root .feat:first-child{ border-top:1px solid var(--line); }
  #presentacion-root .feat-mark{ font-family:var(--mono); font-size:12px; color:var(--gold); flex-shrink:0; width:26px; }
  #presentacion-root .feat-body strong{ font-family:var(--serif); font-weight:600; font-size:20px; display:block; color:var(--cream); }
  #presentacion-root .feat-body span{ font-size:14.5px; color:var(--cream-dim); }

  #presentacion-root .timeline{ position:relative; margin-top:60px; max-width:520px; width:100%; padding-left:38px; }
  #presentacion-root .timeline-line{
    position:absolute; left:9px; top:6px; bottom:6px; width:2px;
    background:var(--line);
  }
  #presentacion-root .timeline-fill{
    position:absolute; left:9px; top:6px; width:2px; height:0%;
    background:var(--gold); transition:height 1.4s cubic-bezier(.22,.8,.28,1);
  }
  #presentacion-root .tstep{ position:relative; padding-bottom:44px; }
  #presentacion-root .tstep:last-child{ padding-bottom:0; }
  #presentacion-root .tstep::before{
    content:attr(data-n); position:absolute; left:-38px; top:-2px;
    width:20px; height:20px; border-radius:50%; background:var(--felt);
    border:2px solid var(--gold); color:var(--gold-bright);
    font-family:var(--mono); font-size:10px; font-weight:700;
    display:flex; align-items:center; justify-content:center;
  }
  #presentacion-root .tstep strong{ font-family:var(--serif); font-weight:600; font-size:20px; display:block; margin-bottom:4px; }
  #presentacion-root .tstep span{ font-size:14.5px; color:var(--cream-dim); }

  #presentacion-root .puntaje-chips{ display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-top:32px; max-width:420px; }
  #presentacion-root .puntaje-chip{
    font-family:var(--mono); font-size:14px; font-weight:700; color:var(--gold-bright);
    border:1px solid var(--line); border-radius:999px; padding:8px 18px;
  }

  #presentacion-root .phone{
    width:150px; height:280px; border:2px solid var(--gold); border-radius:26px;
    position:relative; margin-bottom:40px;
    box-shadow:0 0 0 rgba(212,169,78,0.0);
    animation:pt-phoneglow 3s ease-in-out infinite;
  }
  #presentacion-root .phone::before{
    content:''; position:absolute; inset:14px; border-radius:14px;
    background:linear-gradient(160deg, rgba(212,169,78,0.14), rgba(193,89,79,0.08));
  }
  #presentacion-root .phone::after{
    content:'♠'; position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    font-size:34px; color:var(--gold-bright); opacity:.85;
  }
  @keyframes pt-phoneglow{
    0%,100%{ box-shadow:0 0 24px rgba(212,169,78,0.05); }
    50%{ box-shadow:0 0 34px rgba(212,169,78,0.22); }
  }
  #presentacion-root .soon-tag{
    font-family:var(--mono); font-size:11px; letter-spacing:.18em; text-transform:uppercase;
    color:var(--rose); border:1px solid rgba(193,89,79,0.4); padding:6px 14px; border-radius:999px;
    margin-bottom:22px;
  }

  #presentacion-root #close{ text-align:center; }
  #presentacion-root .domain{
    font-family:var(--serif); font-weight:800; font-size:clamp(30px,5vw,52px); color:var(--gold-bright);
    letter-spacing:-0.01em;
  }
  #presentacion-root .close-links{ margin-top:30px; display:flex; flex-direction:column; gap:10px; align-items:center; }
  #presentacion-root .close-links a{ color:var(--cream-dim); text-decoration:none; font-size:14px; font-weight:600; }
  #presentacion-root .close-links a:hover{ color:var(--gold-bright); }
  #presentacion-root .alias{ font-size:12.5px; color:var(--cream-dim); margin-top:26px; }
  #presentacion-root .alias b{ color:var(--gold); }

  #presentacion-root .dotnav{
    position:fixed; right:22px; top:50%; transform:translateY(-50%); z-index:5;
    display:flex; flex-direction:column; gap:14px;
  }
  #presentacion-root .dotnav button{
    width:8px; height:8px; border-radius:50%; border:1px solid var(--gold);
    background:transparent; cursor:pointer; padding:0; transition:background .3s ease, transform .3s ease;
  }
  #presentacion-root .dotnav button.active{ background:var(--gold); transform:scale(1.3); }
  @media (max-width:640px){ #presentacion-root .dotnav{ display:none; } }

  #presentacion-root .suitrow{ display:flex; gap:20px; margin-bottom:28px; align-items:center; }
  #presentacion-root .suitrow svg{ width:24px; height:24px; }

  @media (prefers-reduced-motion: reduce){
    #presentacion-root *{ animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; }
  }
`;

export default function PresentacionClient() {
  useEffect(() => {
    const root = document.getElementById("presentacion-root");
    if (!root) return;
    root.classList.add("js-ready");

    // --- palos de la baraja española, iguales a los del producto real ---
    const suitrow = document.getElementById("suitrow");
    if (suitrow) {
      suitrow.innerHTML = `
        <svg viewBox="0 0 20 20" fill="none">
          <line x1="10" y1="2" x2="10" y2="14" stroke="#D4A94E" stroke-width="1.7"/>
          <line x1="5.5" y1="6" x2="14.5" y2="6" stroke="#D4A94E" stroke-width="1.7"/>
          <path d="M8 14H12L10 18L8 14Z" fill="#D4A94E"/>
        </svg>
        <svg viewBox="0 0 20 20" fill="none">
          <line x1="5" y1="16" x2="15" y2="4" stroke="#D4A94E" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="6" cy="15" r="2.1" fill="#D4A94E"/>
          <circle cx="14" cy="5" r="2.1" fill="#D4A94E"/>
        </svg>
        <svg viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7.5" stroke="#D4A94E" stroke-width="1.6"/>
          <circle cx="10" cy="10" r="3.2" stroke="#D4A94E" stroke-width="1.3"/>
        </svg>
        <svg viewBox="0 0 20 20" fill="none">
          <path d="M4 3H16L13.2 10.5C12.5 12.3 11 13 10 13C9 13 7.5 12.3 6.8 10.5L4 3Z" stroke="#D4A94E" stroke-width="1.5" stroke-linejoin="round"/>
          <line x1="10" y1="13" x2="10" y2="16.5" stroke="#D4A94E" stroke-width="1.5"/>
          <line x1="6.5" y1="17.5" x2="13.5" y2="17.5" stroke="#D4A94E" stroke-width="1.5"/>
        </svg>
      `;
    }

    // --- tally marks: dibujo con pathLength normalizado, en loop ambiente ---
    function tallyGroupSVG() {
      return `<svg viewBox="0 0 20 20">
        <line pathLength="1" x1="2" y1="2" x2="18" y2="2"></line>
        <line pathLength="1" x1="18" y1="2" x2="18" y2="18"></line>
        <line pathLength="1" x1="18" y1="18" x2="2" y2="18"></line>
        <line pathLength="1" x1="2" y1="18" x2="2" y2="2"></line>
        <line pathLength="1" x1="2" y1="2" x2="18" y2="18"></line>
      </svg>`;
    }
    function buildGroups(containerId, count) {
      const el = document.getElementById(containerId);
      if (!el) return [];
      el.innerHTML = "";
      for (let g = 0; g < count; g++) {
        const wrap = document.createElement("div");
        wrap.className = "tally";
        wrap.innerHTML = tallyGroupSVG();
        el.appendChild(wrap);
      }
      return el.querySelectorAll(".tally");
    }
    const groupsA = buildGroups("groupsA", 2);
    const groupsB = buildGroups("groupsB", 2);

    function animateTally(groups, baseDelay) {
      groups.forEach((g, gi) => {
        const lines = g.querySelectorAll("line");
        lines.forEach((line, li) => {
          const delay = baseDelay + gi * 900 + li * 180;
          line.style.animation = `pt-draw 0.35s ease forwards`;
          line.style.animationDelay = delay + "ms";
        });
      });
    }
    const styleTag = document.createElement("style");
    styleTag.textContent = `@keyframes pt-draw { to { stroke-dashoffset:0; } }`;
    document.head.appendChild(styleTag);

    function loop() {
      root.querySelectorAll(".tally line").forEach((l) => {
        l.style.animation = "none";
        l.style.strokeDashoffset = "1";
      });
      void document.body.offsetWidth; // reflow
      animateTally(groupsA, 200);
      animateTally(groupsB, 900);
    }
    loop();
    const tallyInterval = setInterval(loop, 5200);

    // --- scroll reveal ---
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("on");
        });
      },
      { threshold: 0.2 }
    );
    root.querySelectorAll(".reveal").forEach((el) => io.observe(el));

    // --- timeline fill ---
    const tfill = document.getElementById("tfill");
    const stepsSection = document.getElementById("steps");
    const io2 = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && tfill) tfill.style.height = "100%";
        });
      },
      { threshold: 0.35 }
    );
    if (stepsSection) io2.observe(stepsSection);

    // --- dot nav ---
    const dots = root.querySelectorAll("#dotnav button");
    const dotHandlers = [];
    dots.forEach((d) => {
      const handler = () => {
        document.getElementById(d.dataset.target)?.scrollIntoView({ behavior: "smooth" });
      };
      dotHandlers.push([d, handler]);
      d.addEventListener("click", handler);
    });
    const sections = [...dots].map((d) => document.getElementById(d.dataset.target)).filter(Boolean);
    const io3 = new IntersectionObserver(
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
    sections.forEach((s) => io3.observe(s));

    return () => {
      clearInterval(tallyInterval);
      io.disconnect();
      io2.disconnect();
      io3.disconnect();
      dotHandlers.forEach(([d, handler]) => d.removeEventListener("click", handler));
      styleTag.remove();
    };
  }, []);

  return (
    <div id="presentacion-root">
      <style>{CSS}</style>
      <div className="glow"></div>

      <nav className="dotnav" id="dotnav">
        <button data-target="hero" className="active"></button>
        <button data-target="feats"></button>
        <button data-target="puntaje"></button>
        <button data-target="steps"></button>
        <button data-target="app"></button>
        <button data-target="close"></button>
      </nav>

      <section id="hero">
        <div className="suitrow" id="suitrow"></div>
        <div className="eyebrow">Para organizadores de truco</div>
        <h1>
          El torneo se
          <br />
          arma <em>solo.</em>
        </h1>
        <p className="sub">Sorteo automático, cuadro en vivo, y cada equipo anota sus propios puntos desde el celular.</p>
        <a className="hero-cta" href="https://torneotruco.com.ar" target="_blank" rel="noreferrer">
          torneotruco.com.ar →
        </a>

        <div className="scoreboard-demo">
          <div className="sb-team">
            <div className="sb-name">Sol de Mayo</div>
            <div className="sb-groups" id="groupsA"></div>
          </div>
          <div className="sb-team">
            <div className="sb-name">Río Platenses</div>
            <div className="sb-groups" id="groupsB"></div>
          </div>
        </div>

        <div className="scroll-hint">
          <span className="stick"></span>desliza
        </div>
      </section>

      <section id="feats">
        <div className="eyebrow">Se acabó el lápiz y papel</div>
        <h2 className="reveal">
          Todo lo que hoy
          <br />
          se hace a mano
        </h2>
        <div className="feat-list">
          <div className="feat reveal d1">
            <div className="feat-mark">01</div>
            <div className="feat-body">
              <strong>Sorteo automático</strong>
              <span>arma el cuadro solo, sin favoritismos</span>
            </div>
          </div>
          <div className="feat reveal d2">
            <div className="feat-mark">02</div>
            <div className="feat-body">
              <strong>Cuadro en vivo</strong>
              <span>se actualiza al instante, todos ven lo mismo</span>
            </div>
          </div>
          <div className="feat reveal d3">
            <div className="feat-mark">03</div>
            <div className="feat-body">
              <strong>Anotador por código</strong>
              <span>cada equipo entra con su código y carga sus propios puntos</span>
            </div>
          </div>
          <div className="feat reveal d4">
            <div className="feat-mark">04</div>
            <div className="feat-body">
              <strong>Repechaje opcional</strong>
              <span>una segunda chance para los que pierden</span>
            </div>
          </div>
          <div className="feat reveal d5">
            <div className="feat-mark">05</div>
            <div className="feat-body">
              <strong>Sistema Vidon Bar</strong>
              <span>un formato alternativo donde los que pierden van rellenando el cuadro hasta completarlo, nadie queda afuera de entrada</span>
            </div>
          </div>
          <div className="feat reveal d6">
            <div className="feat-mark">06</div>
            <div className="feat-body">
              <strong>Historial de campeones</strong>
              <span>quedan guardados todos los ganadores de tus torneos anteriores</span>
            </div>
          </div>
        </div>
      </section>

      <section id="puntaje">
        <div className="eyebrow">Se adapta a tu mesa</div>
        <h2 className="reveal">Jugás como quieras</h2>
        <p className="sub reveal d1">
          Puntaje a 15, 18, 20, 24, 30 o 40 — adaptado tanto al truco argentino como al uruguayo.
        </p>
        <div className="puntaje-chips reveal d2">
          <span className="puntaje-chip">15</span>
          <span className="puntaje-chip">18</span>
          <span className="puntaje-chip">20</span>
          <span className="puntaje-chip">24</span>
          <span className="puntaje-chip">30</span>
          <span className="puntaje-chip">40</span>
        </div>
      </section>

      <section id="steps">
        <div className="eyebrow">Cinco pasos</div>
        <h2 className="reveal">
          De cero a jugando
          <br />
          en un rato
        </h2>
        <div className="timeline">
          <div className="timeline-line"></div>
          <div className="timeline-fill" id="tfill"></div>
          <div className="tstep" data-n="1">
            <strong>Pedís acceso</strong>
            <span>con tu email, sin contraseña</span>
          </div>
          <div className="tstep" data-n="2">
            <strong>Creás el torneo</strong>
            <span>nombre, lugar, fecha, categoría</span>
          </div>
          <div className="tstep" data-n="3">
            <strong>Anotás los equipos</strong>
            <span>y marcás quién ya pagó</span>
          </div>
          <div className="tstep" data-n="4">
            <strong>Tocás sorteo</strong>
            <span>el cuadro se arma solo</span>
          </div>
          <div className="tstep" data-n="5">
            <strong>Compartís el código de cada equipo</strong>
            <span>juegan, anotan, listo</span>
          </div>
        </div>
      </section>

      <section id="app">
        <div className="soon-tag reveal">Lo que viene</div>
        <div className="phone reveal d1"></div>
        <h2 className="reveal d2">
          Ya viene en camino
          <br />
          la aplicación.
        </h2>
        <p className="sub reveal d3">Todo esto, pero como app — para tenerla siempre a mano en cada mesa, cada torneo.</p>
      </section>

      <section id="close">
        <div className="eyebrow">Entrá cuando quieras</div>
        <div className="domain">torneotruco.com.ar</div>
        <div className="close-links">
          <a href="https://instagram.com/truco.cordoba" target="_blank" rel="noreferrer">
            📸 @truco.cordoba
          </a>
        </div>
        <p className="alias">
          Si te sirvió, una colaboración se agradece — alias <b>Envidito</b>
        </p>
      </section>
    </div>
  );
}
