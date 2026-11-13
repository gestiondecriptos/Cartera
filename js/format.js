// Formato y mini-gráficos compartidos por las pestañas (sin librerías).
export const fmt = (n, o) => n.toLocaleString('es-ES', o);
export const usd = n => fmt(n, { style: 'currency', currency: 'USD' });
export const qty = n => fmt(n, { maximumFractionDigits: 6 });
export const pct = (n, d = 1) => fmt(n, { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
export const cls = n => (n < 0 ? 'neg' : '');
export const COLORS = ['#38bdf8', '#f7931a', '#22c55e', '#a78bfa', '#fbbf24', '#f472b6'];

const legend = (parts, total) => parts.map((p, i) =>
  `<span><i style="display:inline-block;width:.6rem;height:.6rem;border-radius:2px;background:${p.color || COLORS[i % 6]}"></i> ${p.label} <b class="num">${pct(p.value / total * 100)}</b></span>`).join('');

/** Barra horizontal al 100%: parts = [{label, value, color?}] */
export function stackedBar(title, parts) {
  const total = parts.reduce((t, p) => t + p.value, 0);
  if (!total) return `<div><div class="mb-1 text-sm">${title}</div><div class="label">Sin datos</div></div>`;
  return `<div><div class="mb-1 text-sm">${title}</div>
    <div class="flex h-6 overflow-hidden rounded bg-[#11131f]">${parts.map((p, i) =>
      `<div style="width:${p.value / total * 100}%;background:${p.color || COLORS[i % 6]}" title="${p.label}"></div>`).join('')}</div>
    <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">${legend(parts, total)}</div></div>`;
}

/** Anillo con conic-gradient */
export function donut(parts, size = 150) {
  const total = parts.reduce((t, p) => t + p.value, 0) || 1;
  let acc = 0;
  const stops = parts.map((p, i) => {
    const a = acc / total * 100; acc += p.value;
    return `${p.color || COLORS[i % 6]} ${a}% ${acc / total * 100}%`;
  }).join(',');
  return `<div class="flex flex-wrap items-center gap-4">
    <div style="width:${size}px;height:${size}px;border-radius:50%;background:conic-gradient(${stops});-webkit-mask:radial-gradient(circle,transparent 55%,#000 56%);mask:radial-gradient(circle,transparent 55%,#000 56%)"></div>
    <div class="flex flex-col gap-1 text-xs text-slate-400">${legend(parts, total).replaceAll('</span>', '</span>')}</div></div>`;
}

export const short = a => (a.length > 16 ? a.slice(0, 8) + '…' + a.slice(-4) : a);
