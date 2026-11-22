// Espiral de Bitcoin: precio diario desde 2010. Una vuelta = 4 años (2009 arriba, sentido horario). Radio = precio (escala logarítmica).
// Halo de color = zona del ciclo (misma lógica que la tarjeta «Ciclo de halvings»). Sin librerías.
import { HALVING_DATES } from './bitview.js';
import { usd, fmt } from './format.js';

const DAY = 864e5, W = 640, C = 320, TURN = 4 * 365.25 * DAY, T0 = Date.UTC(2009, 0, 1);
const P_MIN = 0.05, R_MIN = 12, R_MAX = 270, L0 = Math.log10(P_MIN), K = (R_MAX - R_MIN) / (6 - L0);
const ZC = { max: ['#22c55e', 'Zona de máximos'], min: ['#ef4444', 'Zona de mínimos'], up: ['#38bdf8', 'Zona alcista'], down: ['#f59e0b', 'Zona bajista'] };
const dateEs = t => new Date(t).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
const f1 = v => v.toFixed(1);

function polar(t, p) {
  const a = (t - T0) / TURN * 2 * Math.PI;
  const r = Math.min(R_MAX + 10, R_MIN + K * (Math.log10(Math.max(p, P_MIN)) - L0));
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
}

/** Zona según días desde el halving (x) y día del máximo del ciclo respecto al halving (A): idéntica a la de «Ciclo de halvings» */
function zoneOf(x, A) {
  const zs = [{ k: 'max', a: 370, b: 540 }];
  if (A != null) zs.push({ k: 'min', a: A + 267, b: A + 406 });
  const z = zs.find(q => x >= q.a && x < q.b);
  if (z) return z.k;
  const done = zs.filter(q => q.b <= x).sort((p, q) => q.b - p.b)[0];
  if (done) return done.k === 'min' ? 'up' : 'down';
  return zs.slice().sort((p, q) => p.a - q.a)[0].k === 'max' ? 'up' : 'down';
}

let GEO = null;   // geometría de la última espiral dibujada (la usa el tooltip)

function build(d) {
  const T = d.t, P = d.price, n = T.length;
  const first = P.findIndex(v => v > 0);
  if (first < 0) return null;
  let last = n - 1; while (last > first && !(P[last] > 0)) last--;
  const Hs = [null, ...Object.values(HALVING_DATES).map(s => Date.parse(s))];   // Hs[1..4]
  const ix = t => Math.max(0, Math.min(n, Math.round((t - T[0]) / DAY)));
  const Hh = i => { const v = d.high && d.high[i]; return v > P[i] ? v : P[i]; };                      // máximo del día (o el cierre si no hay)
  const argmax = (a, b) => { let m = -1; for (let i = Math.max(a, first); i < Math.min(b, last + 1); i++) if (P[i] > 0 && (m < 0 || Hh(i) > Hh(m))) m = i; return m; };
  const Lw = i => { const v = d.low && d.low[i]; return v > 0 && v < P[i] ? v : P[i]; };          // mínimo del día (o el cierre si no hay)
  const argmin = (a, b) => { let m = -1; for (let i = Math.max(a, first); i < Math.min(b, last + 1); i++) if (P[i] > 0 && (m < 0 || Lw(i) < Lw(m))) m = i; return m; };
  const near = t => { let i = Math.min(last, Math.max(first, ix(t))); for (let k = 0; k < 10 && !(P[i] > 0); k++) i = Math.min(last, i + 1); return i; };

  // Máximo de cada ciclo: 0 = previo al 1.er halving; 1..3 = máximo en los 730 días tras el halving; 4 = ATH actual (como la tarjeta)
  const aI = [argmax(first, ix(Hs[1]))];
  for (let c = 1; c <= 3; c++) aI[c] = argmax(ix(Hs[c]), ix(Math.min(Hs[c] + 730 * DAY, Hs[c + 1])));
  aI[4] = d.ath && d.ath.t >= Hs[4] ? near(d.ath.t) : argmax(ix(Hs[4]), ix(Hs[4] + 730 * DAY));
  const cyc = t => { let c = 0; for (let k = 1; k <= 4; k++) if (t >= Hs[k]) c = k; return c; };
  const zoneFor = t => { const c = cyc(t); return c === 0 || aI[c] < 0 ? 'none' : zoneOf((t - Hs[c]) / DAY, (T[aI[c]] - Hs[c]) / DAY); };

  // Puntos de la línea (1 de cada 3 días + el último)
  const pts = [];
  for (let i = first; i <= last; i += 3) if (P[i] > 0) pts.push(i);
  if (pts.at(-1) !== last) pts.push(last);
  const line = pts.map(i => { const [x, y] = polar(T[i], P[i]); return { x, y, t: T[i], p: P[i], z: zoneFor(T[i]) }; });

  // Marcas
  const marks = [];
  const mk = (kind, label, i, p = P[i]) => { const [x, y] = polar(T[i], p); marks.push({ kind, label, x, y, t: T[i], p, z: zoneFor(T[i]) }); };
  for (let k = 1; k <= 4; k++) if (Hs[k] <= T[last]) mk('h', `Halving ${k}.º`, near(Hs[k]));
  for (let c = 0; c <= 4; c++) {
    if (aI[c] < 0) continue;
    const end = c < 4 ? aI[c + 1] : last + 1;
    if (c === 4 && T[last] - T[aI[4]] < 267 * DAY) continue;                    // aún no empezó la zona de mínimos
    const m = argmin(aI[c] + 1, end);
    if (m >= 0) mk('l', (c === 4 ? 'Mínimo desde el máximo (ciclo sin cerrar)' : 'Mínimo de ciclo') + (Lw(m) < P[m] ? ' · mín. del día' : ''), m, Lw(m));
  }
  let run = 0; const byMonth = new Map();                                       // máximos históricos (intradía): el más alto de cada mes
  for (let i = first; i <= last; i++) if (Hh(i) > run) { run = Hh(i); byMonth.set(new Date(T[i]).toISOString().slice(0, 7), i); }
  for (const i of byMonth.values()) mk('a', 'Máximo histórico' + (Hh(i) > P[i] ? ' · máx. del día' : ''), i, Hh(i));

  return { line, marks, Hs, aT: aI.map(i => (i >= 0 ? T[i] : null)), zoneFor, cyc, lastPt: line.at(-1) };
}

const path = arr => 'M' + arr.map(q => `${f1(q.x)},${f1(q.y)}`).join('L');
const dot = (c, round = true) => `<i style="display:inline-block;width:.7rem;height:.7rem;margin-right:.35rem;border-radius:${round ? '50%' : '2px'};background:${c}"></i>`;

/** Devuelve {svg, legend} (HTML). Pinta toda la historia de d (resultado de loadMetrics) */
export function spiralChart(d) {
  const g = build(d);
  GEO = g;
  if (!g) return null;

  // Rejilla: anillos por década, ejes, años
  const decs = ['1 $', '10 $', '100 $', '1K $', '10K $', '100K $', '1M $'];
  const rr = i => R_MIN + K * (i - L0);
  let grid = decs.map((_, i) => `<circle cx="${C}" cy="${C}" r="${f1(rr(i))}" fill="none" stroke="#2d3142" stroke-width="1"/>`).join('');
  const dg = R_MAX * Math.SQRT1_2;
  grid += `<g stroke="#2d3142" stroke-width="1"><line x1="${C}" y1="${C - R_MAX - 6}" x2="${C}" y2="${C + R_MAX + 6}"/><line x1="${C - R_MAX - 6}" y1="${C}" x2="${C + R_MAX + 6}" y2="${C}"/></g>`
    + `<g stroke="#2d3142" stroke-width="1" stroke-dasharray="3 4"><line x1="${f1(C - dg)}" y1="${f1(C - dg)}" x2="${f1(C + dg)}" y2="${f1(C + dg)}"/><line x1="${f1(C - dg)}" y1="${f1(C + dg)}" x2="${f1(C + dg)}" y2="${f1(C - dg)}"/></g>`;
  const txt = 'font-size="12" fill="#94a3b8" font-weight="600"';
  grid += `<text x="${C}" y="20" text-anchor="middle" ${txt}>2009 · ’13 · ’17 · ’21 · ’25</text>`
    + `<text x="${C}" y="${W - 8}" text-anchor="middle" ${txt}>2011 · ’15 · ’19 · ’23 · ’27</text>`
    + `<text transform="translate(${W - 10} ${C}) rotate(90)" text-anchor="middle" ${txt}>2010 · ’14 · ’18 · ’22 · ’26</text>`
    + `<text transform="translate(12 ${C}) rotate(-90)" text-anchor="middle" ${txt}>2012 · ’16 · ’20 · ’24 · ’28</text>`;
  grid += decs.map((s, i) => `<text x="${f1(C + rr(i) - 3)}" y="${C + 14}" text-anchor="end" font-size="10" fill="#94a3b8" stroke="#11131f" stroke-width="3" paint-order="stroke">${s}</text>`).join('');

  // Halo por zonas (tramos consecutivos de la misma zona)
  const segs = []; let cur = null;
  g.line.forEach((q, j) => {
    if (!cur || cur.z !== q.z) { cur = { z: q.z, a: j > 0 ? [g.line[j - 1], q] : [q] }; segs.push(cur); } else cur.a.push(q);
  });
  const halo = segs.filter(s => s.z !== 'none' && s.a.length > 1).map(s => `<path d="${path(s.a)}" fill="none" stroke="${ZC[s.z][0]}" stroke-width="9" stroke-opacity=".38" stroke-linejoin="round"/>`).join('');

  const m = { a: [], h: [], l: [] };
  g.marks.forEach(k => m[k.kind].push(k));
  const marks = m.a.map(k => `<circle cx="${f1(k.x)}" cy="${f1(k.y)}" r="2.6" fill="#fff"/>`).join('')
    + m.h.map(k => `<circle cx="${f1(k.x)}" cy="${f1(k.y)}" r="6" fill="#22c55e" stroke="#11131f" stroke-width="2"/>`).join('')
    + m.l.map(k => `<circle cx="${f1(k.x)}" cy="${f1(k.y)}" r="6.5" fill="#ef4444" stroke="#11131f" stroke-width="2"/>`).join('');
  const now = `<circle cx="${f1(g.lastPt.x)}" cy="${f1(g.lastPt.y)}" r="5" fill="#f7931a" stroke="#fff" stroke-width="2"/>`;

  const svg = `<svg class="sp block w-full" viewBox="0 0 ${W} ${W}" role="img" aria-label="Espiral del precio de Bitcoin: una vuelta cada 4 años, radio según el precio">${grid}${halo}<path d="${path(g.line)}" fill="none" stroke="#f7931a" stroke-width="1.6" stroke-linejoin="round"/>${marks}${now}<circle class="sp-h" r="9" fill="none" stroke="#fff" stroke-width="2" visibility="hidden"/></svg>`;
  const legend = `<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">`
    + Object.values(ZC).map(([c, l]) => `<span>${dot(c, false)}${l}</span>`).join('')
    + `<span>${dot('#22c55e')}Halving</span><span>${dot('#ef4444')}Mínimo de ciclo</span><span>${dot('#fff')}Máximo histórico</span><span>${dot('#f7931a')}Hoy</span></div>`
    + `<div class="label mt-1">Cada vuelta = 4 años (2009 arriba, sentido horario). Distancia al centro = precio (log). Sin halo: antes del 1.er halving. Pasa el cursor o toca para ver precio, fecha y zona.</div>`;
  return { svg, legend };
}

/** Tooltip de las espirales dentro de root (llamar tras cada render). Usa el recuadro global #ct-tip de initChartTips() */
export function bindSpirals(root) {
  const tip = document.getElementById('ct-tip');
  if (!tip || !GEO) return;
  const g = GEO;
  const body = (head, t, p, z) => {
    const c = g.cyc(t), parts = [`<div class="label">${head ? `<b style="color:#e2e8f0">${head}</b> · ` : ''}${dateEs(t)}</div><div><b class="num">${usd(p)}</b></div>`];
    parts.push(z === 'none' ? '<div class="label">Ciclo previo al primer halving</div>'
      : `<div>${dot(ZC[z][0], false)}${ZC[z][1]}</div><div class="label">día ${fmt(Math.round((t - g.Hs[c]) / DAY))} desde el halving${g.aT[c] && t > g.aT[c] ? ` · ${fmt(Math.round((t - g.aT[c]) / DAY))} desde el máximo` : ''}</div>`);
    return parts.join('');
  };
  root.querySelectorAll('svg.sp').forEach(svg => {
    const hl = svg.querySelector('.sp-h');
    const hide = () => { tip.style.display = 'none'; hl.setAttribute('visibility', 'hidden'); };
    const show = e => {
      const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * W, vy = (e.clientY - r.top) / r.height * W;
      let best = null, bd = 12 * 12, head = '';
      for (const k of g.marks) { const d2 = (k.x - vx) ** 2 + (k.y - vy) ** 2; if (d2 < bd) { bd = d2; best = k; head = k.label; } }
      if (!best) { bd = 18 * 18; for (const q of g.line) { const d2 = (q.x - vx) ** 2 + (q.y - vy) ** 2; if (d2 < bd) { bd = d2; best = q; } } }
      if (!best) { hide(); return; }
      hl.setAttribute('cx', f1(best.x)); hl.setAttribute('cy', f1(best.y)); hl.setAttribute('visibility', 'visible');
      tip.innerHTML = body(head, best.t, best.p, best.z);
      tip.style.display = 'block';
      tip.style.left = Math.max(4, Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8)) + 'px';
      tip.style.top = Math.max(4, Math.min(e.clientY + 14, innerHeight - tip.offsetHeight - 8)) + 'px';
    };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', hide);
  });
}
