// Gráficos de líneas en SVG (sin librerías)
import { fmt } from './format.js';

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
