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
  @keyframes pt-drift{ 0%{ transform:translate(0,0); } 100%{ transform:translate(-2%, 3%); } }

  #presentacion-root section{
    position:relative; z-index:1;
    min-height:100vh;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:90px 24px; text-align:center;
  }

  #presentacion-root .eyebrow{
    font-family:var(--mono); font-size:11px; letter-spacing:.22em; text-transform:uppercase;
    color:var(--gold); margin-bottom:18px; display:flex; align-items:center; gap:10px;
  }
  #presentacion-root .eyebrow::before{ content:''; width:22px; height:1px; background:var(--gold); display:inline-block; }

  #presentacion-root h1{
    font-family:var(--serif); font-weight:900; font-size:clamp(40px,7vw,86px);
    line-height:1.02; letter-spacing:-0.01em; max-width:14ch;
  }
  #presentacion-root h2{
    font-family:var(--serif); font-weight:700; font-size:clamp(28px,4.2vw,48px);
    line-height:1.1; max-width:16ch;
  }
  #presentacion-root .sub{
    font-size:clamp(15px,1.6vw,19px); color:var(--cream-dim); max-width:46ch;
    line-height:1.65; margin-top:20px;
  }

  #presentacion-root .reveal{ opacity:1; transform:none; transition:opacity .8s ease, transform .8s ease; }
  #presentacion-root.js-ready .reveal{ opacity:0; transform:translateY(28px); }
  #presentacion-root.js-ready .reveal.on{ opacity:1; transform:translateY(0); }
  #presentacion-root .reveal.d1{ transition-delay:.08s; } #presentacion-root .reveal.d2{ transition-delay:.18s; }
  #presentacion-root .reveal.d3{ transition-delay:.28s; } #presentacion-root .reveal.d4{ transition-delay:.38s; }

  #presentacion-root .suitrow{ display:flex; gap:20px; margin-bottom:28px; align-items:center; }
  #presentacion-root .suitrow svg{ width:24px; height:24px; }
  #presentacion-root .hero-cta{
    margin-top:38px; display:inline-flex; align-items:center; gap:10px;
    font-family:var(--mono); font-size:13px; letter-spacing:.05em;
    color:var(--felt); background:var(--gold); padding:15px 28px; border-radius:999px;
    text-decoration:none; font-weight:700;
    transition:transform .25s ease, background .25s ease, box-shadow .25s ease;
  }
  #presentacion-root .hero-cta:hover{ transform:translateY(-2px) scale(1.03); background:var(--gold-bright); box-shadow:0 10px 30px rgba(212,169,78,0.25);}
  #presentacion-root .scroll-hint{
    position:absolute; bottom:38px; left:50%; transform:translateX(-50%);
    font-family:var(--mono); font-size:10px; letter-spacing:.2em; text-transform:uppercase;
    color:var(--cream-dim); display:flex; flex-direction:column; align-items:center; gap:8px; opacity:.7;
  }
  #presentacion-root .scroll-hint .stick{ width:1px; height:30px; background:linear-gradient(var(--gold), transparent); animation:pt-pulse 1.8s ease-in-out infinite; }
  @keyframes pt-pulse{ 0%,100%{opacity:.3;} 50%{opacity:1;} }

  #presentacion-root .feat-list{ margin-top:56px; display:flex; flex-direction:column; gap:0; width:100%; max-width:640px; }
  #presentacion-root .feat{ display:flex; align-items:baseline; gap:24px; padding:24px 4px; border-bottom:1px solid var(--line); text-align:left; }
  #presentacion-root .feat:first-child{ border-top:1px solid var(--line); }
  #presentacion-root .feat-mark{ font-family:var(--mono); font-size:12px; color:var(--gold); flex-shrink:0; width:26px; }
  #presentacion-root .feat-body strong{ font-family:var(--serif); font-weight:600; font-size:19px; display:block; color:var(--cream); }
  #presentacion-root .feat-body span{ font-size:14px; color:var(--cream-dim); }

  #presentacion-root .timeline{ position:relative; margin-top:56px; max-width:460px; width:100%; padding-left:38px; text-align:left; }
  #presentacion-root .timeline-line{ position:absolute; left:9px; top:6px; bottom:6px; width:2px; background:var(--line); }
  #presentacion-root .timeline-fill{ position:absolute; left:9px; top:6px; width:2px; height:0%; background:var(--gold); transition:height 1.4s cubic-bezier(.22,.8,.28,1); }
  #presentacion-root .tstep{ position:relative; padding-bottom:38px; }
  #presentacion-root .tstep:last-child{ padding-bottom:0; }
  #presentacion-root .tstep::before{
    content:attr(data-n); position:absolute; left:-38px; top:-2px;
    width:20px; height:20px; border-radius:50%; background:var(--felt);
    border:2px solid var(--gold); color:var(--gold-bright);
    font-family:var(--mono); font-size:10px; font-weight:700;
    display:flex; align-items:center; justify-content:center;
  }
  #presentacion-root .tstep strong{ font-family:var(--serif); font-weight:600; font-size:19px; display:block; margin-bottom:4px; }
  #presentacion-root .tstep span{ font-size:14px; color:var(--cream-dim); }
  #presentacion-root .badges-row{ display:flex; gap:12px; flex-wrap:wrap; justify-content:center; margin-top:44px; }
  #presentacion-root .badge{
    font-family:var(--mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; font-weight:700;
    padding:9px 16px; border-radius:999px; border:1px solid var(--line); color:var(--gold-bright);
  }

  #presentacion-root .mock-score{ margin-top:44px; display:flex; gap:48px; align-items:flex-start; }
  #presentacion-root .mock-team{ text-align:center; }
  #presentacion-root .mock-name{ font-family:var(--mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--cream-dim); margin-bottom:14px; }
  #presentacion-root .mock-groups{ display:flex; gap:8px; }
  #presentacion-root .tally svg{ width:30px; height:30px; overflow:visible; }
  #presentacion-root .tally line{ stroke:var(--gold-bright); stroke-width:2.6; stroke-linecap:round; fill:none; stroke-dasharray:1 1; stroke-dashoffset:1; }
  #presentacion-root .mock-caption{ margin-top:18px; font-family:var(--mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--cream-dim); }
  #presentacion-root .anotador-text{ max-width:38ch; margin-top:30px; }
  #presentacion-root .anotador-text p{ font-size:14.5px; color:var(--cream-dim); line-height:1.65; }
  #presentacion-root .anotador-text p + p{ margin-top:10px; }
  #presentacion-root .anotador-text b{ color:var(--gold-bright); }

  #presentacion-root .bracket{ margin-top:48px; display:flex; flex-direction:column; align-items:center; gap:14px; }
  #presentacion-root .bracket-row{ display:flex; gap:14px; align-items:center; flex-wrap:wrap; justify-content:center; }
  #presentacion-root .bracket-pair{ display:flex; flex-direction:column; border:1px solid var(--line); border-radius:12px; overflow:hidden; width:170px; }
  #presentacion-root .bracket-pair span{ padding:10px 14px; font-family:var(--serif); font-size:14px; font-weight:600; text-align:left; color:var(--cream); }
  #presentacion-root .bracket-pair span:first-child{ border-bottom:1px solid var(--line); }
  #presentacion-root .bracket-vs{ font-family:var(--mono); font-size:11px; color:var(--cream-dim); font-weight:700; }
  #presentacion-root .bracket-down{ font-size:18px; color:var(--cream-dim); }
  #presentacion-root .bracket-winner{ font-family:var(--serif); display:flex; align-items:center; gap:8px; font-size:20px; font-weight:700; color:var(--gold-bright); margin-top:4px; }
  #presentacion-root .live-dot{ display:inline-flex; align-items:center; gap:8px; margin-top:20px; font-family:var(--mono); font-size:11px; font-weight:700; letter-spacing:.12em; color:var(--rose); }
  #presentacion-root .live-dot i{ width:8px; height:8px; border-radius:50%; background:var(--rose); animation:pt-blink 1.6s ease-in-out infinite; }
  @keyframes pt-blink{ 0%,100%{opacity:1;} 50%{opacity:.25;} }

  #presentacion-root .quote-solved{ margin-top:36px; display:inline-flex; align-items:center; gap:12px; flex-wrap:wrap; justify-content:center; }
  #presentacion-root .quote-solved span{ font-family:var(--serif); font-size:18px; font-style:italic; color:var(--cream-dim); text-decoration:line-through; text-decoration-thickness:1.5px; }
  #presentacion-root .solved-tag{ font-family:var(--mono); font-size:11px; font-weight:700; letter-spacing:.05em; color:var(--gold-bright); border:1px solid var(--line); padding:6px 12px; border-radius:999px; }

  #presentacion-root .chip-group{ margin-top:40px; }
  #presentacion-root .chip-group-label{ font-family:var(--mono); font-size:11px; font-weight:700; color:var(--cream-dim); text-transform:uppercase; letter-spacing:.15em; margin-bottom:12px; }
  #presentacion-root .chips{ display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-bottom:28px; }
  #presentacion-root .chip{ font-family:var(--serif); font-size:14px; font-weight:600; padding:9px 18px; border-radius:999px; border:1px solid var(--line); color:var(--cream); }
  #presentacion-root .config-close{ font-family:var(--serif); font-size:20px; font-weight:600; color:var(--gold-bright); margin-top:14px; max-width:22ch; }

  #presentacion-root .price{ font-family:var(--serif); font-size:clamp(56px,10vw,100px); font-weight:800; color:var(--gold-bright); margin-top:52px; line-height:1; }
  #presentacion-root .price-caption{ font-family:var(--mono); font-size:11px; font-weight:700; color:var(--cream-dim); text-transform:uppercase; letter-spacing:.15em; margin-top:10px; }
  #presentacion-root .price-fine{ font-size:13.5px; color:var(--cream-dim); margin-top:22px; }

  #presentacion-root .domain{ font-family:var(--serif); font-weight:800; font-size:clamp(30px,5vw,52px); color:var(--gold-bright); letter-spacing:-0.01em; text-decoration:none; }
  #presentacion-root .close-links{ margin-top:30px; display:flex; flex-direction:column; gap:10px; align-items:center; }
  #presentacion-root .close-links a{ color:var(--cream-dim); text-decoration:none; font-size:14px; font-weight:600; }
  #presentacion-root .close-links a:hover{ color:var(--gold-bright); }

  #presentacion-root .dotnav{ position:fixed; right:22px; top:50%; transform:translateY(-50%); z-index:5; display:flex; flex-direction:column; gap:14px; }
  #presentacion-root .dotnav button{ width:8px; height:8px; border-radius:50%; border:1px solid var(--gold); background:transparent; cursor:pointer; padding:0; transition:background .3s ease, transform .3s ease; }
  #presentacion-root .dotnav button.active{ background:var(--gold); transform:scale(1.3); }
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
    const groupsB = buildGroups("groupsB", 1);

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

    function tallyLoop() {
      root.querySelectorAll(".tally line").forEach((l) => {
        l.style.animation = "none";
        l.style.strokeDashoffset = "1";
      });
      void document.body.offsetWidth;
      animateTally(groupsA, 200);
      animateTally(groupsB, 900);
    }
    tallyLoop();
    const tallyInterval = setInterval(tallyLoop, 5200);

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("on");
        });
      },
      { threshold: 0.2 }
    );
    root.querySelectorAll(".reveal").forEach((el) => io.observe(el));

    const tfill = document.getElementById("tfill");
    const solucionSection = document.getElementById("solucion");
    const io2 = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && tfill) tfill.style.height = "100%";
        });
      },
      { threshold: 0.35 }
    );
    if (solucionSection) io2.observe(solucionSection);

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
        {SECTIONS.map((id, i) => (
          <button key={id} data-target={id} className={i === 0 ? "active" : ""}></button>
        ))}
      </nav>

      <section id="hero">
        <div className="suitrow" id="suitrow"></div>
        <div className="eyebrow">Para organizadores de truco</div>
        <h1>Torneo de Truco</h1>
        <p className="sub">Organizá torneos de truco en tu bar.</p>
        <a className="hero-cta" href="https://torneotruco.com.ar" target="_blank" rel="noreferrer">
          torneotruco.com.ar →
        </a>
        <div className="scroll-hint">
          <span className="stick"></span>desliza
        </div>
      </section>

      <section id="problema">
        <div className="eyebrow">El problema</div>
        <h2 className="reveal">Organizar a mano es un quilombo</h2>
        <div className="feat-list">
          <div className="feat reveal d1">
            <div className="feat-mark">01</div>
            <div className="feat-body">
              <strong>Anotar en papel</strong>
              <span>se pierde, se mancha, no lo ve nadie más que vos</span>
            </div>
          </div>
          <div className="feat reveal d2">
            <div className="feat-mark">02</div>
            <div className="feat-body">
              <strong>Gritar los cruces</strong>
              <span>medio bar preguntando quién juega contra quién</span>
            </div>
          </div>
          <div className="feat reveal d3">
            <div className="feat-mark">03</div>
            <div className="feat-body">
              <strong>Discusiones por el conteo</strong>
              <span>nadie se pone de acuerdo en qué marcaba el papelito</span>
            </div>
          </div>
          <div className="feat reveal d4">
            <div className="feat-mark">04</div>
            <div className="feat-body">
              <strong>El organizador corre toda la noche</strong>
              <span>de mesa en mesa, sin parar un segundo</span>
            </div>
          </div>
        </div>
      </section>

      <section id="solucion">
        <div className="eyebrow">La solución</div>
        <h2 className="reveal">El torneo se maneja solo</h2>
        <div className="timeline">
          <div className="timeline-line"></div>
          <div className="timeline-fill" id="tfill"></div>
          <div className="tstep" data-n="1">
            <strong>Cargás los equipos</strong>
            <span>solo nombres</span>
          </div>
          <div className="tstep" data-n="2">
            <strong>Sorteo automático</strong>
            <span>la web arma el cuadro</span>
          </div>
          <div className="tstep" data-n="3">
            <strong>El torneo se maneja solo</strong>
            <span>vos atendés el bar</span>
          </div>
        </div>
        <div className="badges-row reveal d1">
          <span className="badge">Gratis</span>
          <span className="badge">Sin instalar nada</span>
          <span className="badge">Sin crear cuenta</span>
        </div>
      </section>

      <section id="anotador">
        <div className="eyebrow">El anotador</div>
        <h2 className="reveal">Cada mesa, su anotador</h2>
        <p className="sub reveal d1">Marcador digital, look tradicional.</p>

        <div className="mock-score reveal d2">
          <div className="mock-team">
            <div className="mock-name">Nosotros</div>
            <div className="mock-groups" id="groupsA"></div>
          </div>
          <div className="mock-team">
            <div className="mock-name">Ellos</div>
            <div className="mock-groups" id="groupsB"></div>
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
        <div className="feat-list" style={{ maxWidth: "420px" }}>
          <div className="feat reveal d1">
            <div className="feat-mark">✓</div>
            <div className="feat-body">
              <strong>Más gente</strong>
            </div>
          </div>
          <div className="feat reveal d1">
            <div className="feat-mark">✓</div>
            <div className="feat-body">
              <strong>Más tiempo consumiendo</strong>
            </div>
          </div>
          <div className="feat reveal d2">
            <div className="feat-mark">✓</div>
            <div className="feat-body">
              <strong>Menos trabajo para el personal</strong>
            </div>
          </div>
          <div className="feat reveal d2">
            <div className="feat-mark">✓</div>
            <div className="feat-body">
              <strong>Imagen moderna</strong>
            </div>
          </div>
        </div>
      </section>

      <section id="close">
        <div className="eyebrow">Entrá cuando quieras</div>
        <h2 className="reveal">Probalo en tu próximo torneo</h2>
        <a className="domain reveal d1" href="https://torneotruco.com.ar" target="_blank" rel="noreferrer">
          torneotruco.com.ar
        </a>
        <p className="sub reveal d2">Armamos tu primer torneo juntos, sin costo y sin compromiso.</p>
        <div className="close-links reveal d3">
          <a href="https://instagram.com/truco.cordoba" target="_blank" rel="noreferrer">
            📸 @truco.cordoba
          </a>
        </div>
      </section>
    </div>
  );
}
