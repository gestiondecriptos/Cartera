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

/** Treemap simple (sin librerías): items = [{label, value}] */
export function treemap(items, height = 280) {
  const data = items.filter(i => i.value > 0).sort((a, b) => b.value - a.value);
  const total = data.reduce((t, i) => t + i.value, 0);
  if (!total) return '<div class="label">Sin datos</div>';
  const out = [];
  (function lay(list, x, y, w, h) {
    if (list.length === 1) return out.push({ ...list[0], x, y, w, h });
    const sum = list.reduce((t, i) => t + i.value, 0);
    let acc = 0, k = 0;
    while (k < list.length - 1 && acc + list[k].value <= sum / 2) acc += list[k++].value;
    if (k === 0) acc = list[k++].value;
    const r = acc / sum, a = list.slice(0, k), b = list.slice(k);
    if (w >= h) { lay(a, x, y, w * r, h); lay(b, x + w * r, y, w * (1 - r), h); }
    else { lay(a, x, y, w, h * r); lay(b, x, y + h * r, w, h * (1 - r)); }
  })(data, 0, 0, 100, 100);
  return `<div style="position:relative;height:${height}px">${out.map((n, i) =>
    `<div title="${n.label}: ${pct(n.value / total * 100)}" style="position:absolute;left:${n.x}%;top:${n.y}%;width:${n.w}%;height:${n.h}%;padding:1px"><div style="background:${COLORS[i % 6]};opacity:.85;height:100%;border-radius:3px;overflow:hidden;color:#0b0d16;font-size:.7rem;padding:3px 5px">${n.w * n.h > 350 ? `${n.label}<br><b class="num">${pct(n.value / total * 100, 0)}</b>` : ''}</div></div>`).join('')}</div>`;
}
