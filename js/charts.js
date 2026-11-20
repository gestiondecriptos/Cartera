// Gráficos de líneas en SVG (sin librerías)
import { fmt, usd } from './format.js';

const W = 640;
const day = t => new Date(t).toISOString().slice(0, 10);
export const thin = (pts, n = 500) => {
  if (pts.length <= n) return pts;
  const step = pts.length / n, out = [];
  for (let i = 0; i < n; i++) out.push(pts[Math.floor(i * step)]);
  out.push(pts.at(-1));
  return out;
};

/**
 * series: [{ label, color, pts: [[tiempoMs, valor|null], ...] }]
 * log: escala logarítmica · lines: [{ y, label }] líneas horizontales · domain: [min, max] fijo
 */
export function lineChart({ series, log = false, lines = [], domain = null, height = 220, yfmt = v => fmt(v, { maximumFractionDigits: 0 }) }) {
  const ok = v => Number.isFinite(v) && (!log || v > 0);
  const all = series.flatMap(s => s.pts).filter(p => ok(p[1]));
  if (all.length < 2) return '<div class="label p-6">Sin datos disponibles para este gráfico.</div>';
  const tr = v => (log ? Math.log(v) : v), P = 6, H = height;
  const t0 = Math.min(...all.map(p => p[0])), t1 = Math.max(...all.map(p => p[0]));
  const vals = all.map(p => p[1]);
  const lo = domain ? domain[0] : Math.min(...vals), hi = domain ? domain[1] : Math.max(...vals);
  const ya = tr(Math.max(lo, log ? 1e-9 : -Infinity)), yb = tr(hi);
  const X = t => P + (t - t0) / (t1 - t0 || 1) * (W - 2 * P);
  const Y = v => H - P - (Math.min(Math.max(tr(v), ya), yb) - ya) / (yb - ya || 1) * (H - 2 * P);

  const paths = series.map(s => {
    let d = '', pen = false;
    for (const [t, v] of s.pts) {
      if (!ok(v)) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${X(t).toFixed(1)},${Y(v).toFixed(1)}`; pen = true;
    }
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="1.6" stroke-linejoin="round"/>`;
  }).join('');
  const hl = lines.filter(l => ok(l.y)).map(l =>
    `<line x1="${P}" x2="${W - P}" y1="${Y(l.y).toFixed(1)}" y2="${Y(l.y).toFixed(1)}" stroke="#64748b" stroke-dasharray="4 4"/><text x="${W - P - 2}" y="${(Y(l.y) - 3).toFixed(1)}" text-anchor="end" fill="#94a3b8" font-size="10">${l.label}</text>`).join('');
  const legend = series.map(s => `<span><i style="display:inline-block;width:.6rem;height:.2rem;background:${s.color}"></i> ${s.label}</span>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="w-full" role="img" aria-label="${series.map(s => s.label).join(', ')}">${hl}${paths}</svg>
    <div class="num mt-1 flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>${day(t0)}</span><span>mín ${yfmt(lo)} · máx ${yfmt(hi)}${log ? ' · escala log' : ''}</span><span>${day(t1)}</span></div>
    <div class="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-400">${legend}</div>`;
}

/* ---------- Gráfico con eje Y y tooltip (Inicio, Manual…) ---------- */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
const KIND = {
  usd: v => usd(v),
  eur: v => fmt(v, { style: 'currency', currency: 'EUR' }),
  idx: v => fmt(v, { maximumFractionDigits: 1 }),
};
function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || Math.abs(hi) || 1, raw = span / (n - 1), mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
  const out = [];
  for (let k = Math.floor(lo / step); k <= Math.ceil(hi / step); k++) out.push(k * step);
  if (out.length < 2) out.push(out[0] + step);
  return out;
}

/**
 * series: [{ label, color, pts: [[tiempoMs, valor, valorOriginal?], ...] }]
 * zero / yMin / yMax: incluir siempre el 0 (o esos valores) en el eje Y · kind: 'usd' | 'eur' | 'idx' (formato del valor) · rawKind: formato del 3.er dato (opcional) · time: mostrar hora en el tooltip
 */
export function axisChart({ series, kind = 'usd', rawKind = null, time = false, height = 220, zero = false, yMin = null, yMax = null }) {
  const S = series.map(s => ({ ...s, pts: s.pts.filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1])) })).filter(s => s.pts.length);
  const all = S.flatMap(s => s.pts);
  if (all.length < 2) return '<div class="label p-6">Sin datos disponibles para este gráfico.</div>';
  const W = Math.max(300, Math.min(640, Math.round((typeof innerWidth === 'number' ? innerWidth : 700) - 56)));
  const H = height, PL = 52, PR = 10, PT = 8, PB = 20;
  let t0 = Infinity, t1 = -Infinity, lo = Infinity, hi = -Infinity;
  for (const p of all) { t0 = Math.min(t0, p[0]); t1 = Math.max(t1, p[0]); lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
  if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (yMin != null) lo = Math.min(lo, yMin);
  if (yMax != null) hi = Math.max(hi, yMax);
  const ticks = niceTicks(lo, hi), y0 = ticks[0], y1 = ticks.at(-1);
  const X = t => PL + (t - t0) / (t1 - t0 || 1) * (W - PL - PR);
  const Y = v => H - PB - (v - y0) / (y1 - y0 || 1) * (H - PT - PB);
  const yl = v => (kind === 'idx' ? fmt(v, { maximumFractionDigits: 0 }) : compact.format(v));
  const grid = ticks.map(v => `<line x1="${PL}" x2="${W - PR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="#2d3142" stroke-width=".6"/><text x="${PL - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end" fill="#94a3b8" font-size="10">${yl(v)}</text>`).join('');
  const xl = [0, 1 / 3, 2 / 3, 1].map((f, i) => `<text x="${X(t0 + f * (t1 - t0)).toFixed(1)}" y="${H - 5}" text-anchor="${i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}" fill="#94a3b8" font-size="10">${day(t0 + f * (t1 - t0))}</text>`).join('');
  const paths = S.map(s => `<path d="${s.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`).join('');
  const dots = S.map(s => (s.pts.length <= 80 ? s.pts.map(p => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="2.6" fill="${s.color}"/>`).join('') : '')).join('');
  const marks = `<line class="ct-v" y1="${PT}" y2="${H - PB}" stroke="#64748b" stroke-dasharray="3 3" visibility="hidden"/>`
    + S.map((s, i) => `<circle class="ct-m" data-i="${i}" r="4.5" fill="${s.color}" stroke="#0b0d16" stroke-width="1.5" visibility="hidden"/>`).join('');
  const data = {
    W, H, PL, PR, PT, PB, t0, t1, y0, y1, kind, rk: rawKind, time,
    s: S.map(s => ({ l: s.label, c: s.color, p: s.pts.map(p => (p[2] != null ? [p[0], +p[1].toFixed(4), +(+p[2]).toFixed(4)] : [p[0], +p[1].toFixed(4)])) })),
  };
  return `<svg viewBox="0 0 ${W} ${H}" class="ct w-full" style="touch-action:pan-y" role="img" aria-label="${esc(S.map(s => s.label).join(', '))}" data-ct="${esc(JSON.stringify(data))}">${grid}${xl}${paths}${dots}${marks}</svg>`;
}

/** Tooltip global: gráficos «svg.ct» (valor al pasar el cursor o tocar) y cualquier elemento con data-tip. Llamar una sola vez al arrancar. */
export function initChartTips() {
  if (typeof document === 'undefined' || document.getElementById('ct-tip')) return;
  const tip = document.createElement('div');
  tip.id = 'ct-tip';
  tip.style.cssText = 'position:fixed;z-index:60;pointer-events:none;display:none;background:#0b0d16;border:1px solid #2d3142;border-radius:6px;padding:6px 10px;font-size:.8rem;line-height:1.35;white-space:nowrap';
  document.body.appendChild(tip);
  const cache = new WeakMap();
  let shown = null;
  const place = (x, y) => {
    tip.style.display = 'block';
    tip.style.left = Math.max(4, Math.min(x + 14, innerWidth - tip.offsetWidth - 8)) + 'px';
    tip.style.top = Math.max(4, Math.min(y + 14, innerHeight - tip.offsetHeight - 8)) + 'px';
  };
  const hide = () => {
    tip.style.display = 'none';
    if (shown) { shown.querySelectorAll('.ct-v,.ct-m').forEach(e => e.setAttribute('visibility', 'hidden')); shown = null; }
  };
  const chartTip = (svg, e) => {
    let c = cache.get(svg);
    if (!c) { try { c = JSON.parse(svg.dataset.ct); } catch { return; } cache.set(svg, c); }
    const r = svg.getBoundingClientRect(), cx = (e.clientX - r.left) / r.width * c.W;
    if (cx < c.PL || cx > c.W - c.PR) { hide(); return; }
    const tt = c.t0 + (cx - c.PL) / (c.W - c.PL - c.PR) * (c.t1 - c.t0);
    const X = t => c.PL + (t - c.t0) / (c.t1 - c.t0 || 1) * (c.W - c.PL - c.PR);
    const Y = v => c.H - c.PB - (v - c.y0) / (c.y1 - c.y0 || 1) * (c.H - c.PT - c.PB);
    if (shown && shown !== svg) hide();
    shown = svg;
    let head = null, rows = '';
    c.s.forEach((s, i) => {
      let bp = null, bd = Infinity;
      for (const p of s.p) { const d = Math.abs(p[0] - tt); if (d < bd) { bd = d; bp = p; } }
      if (!bp) return;
      if (head == null) head = bp[0];
      rows += `<div><i style="display:inline-block;width:.6rem;height:.6rem;border-radius:50%;background:${s.c}"></i> ${s.l}: <b class="num">${KIND[c.kind](bp[1])}</b>${bp[2] != null && c.rk ? ` · <span class="num">${KIND[c.rk](bp[2])}</span>` : ''}</div>`;
      const m = svg.querySelector(`.ct-m[data-i="${i}"]`);
      if (m) { m.setAttribute('cx', X(bp[0]).toFixed(1)); m.setAttribute('cy', Y(bp[1]).toFixed(1)); m.setAttribute('visibility', 'visible'); }
    });
    if (head == null) return;
    const v = svg.querySelector('.ct-v');
    if (v) { v.setAttribute('x1', X(head).toFixed(1)); v.setAttribute('x2', X(head).toFixed(1)); v.setAttribute('visibility', 'visible'); }
    tip.innerHTML = `<div class="label">${c.time ? new Date(head).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : day(head)}</div>${rows}`;
    place(e.clientX, e.clientY);
  };
  const onMove = e => {
    const t = e.target instanceof Element ? e.target : null;
    const svg = t && t.closest('svg.ct');
    if (svg) { chartTip(svg, e); return; }
    const el = t && t.closest('[data-tip]');
    hide();
    if (el) { tip.innerHTML = el.dataset.tip; place(e.clientX, e.clientY); }
  };
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerdown', onMove, { passive: true });
  document.addEventListener('scroll', hide, true);
}
