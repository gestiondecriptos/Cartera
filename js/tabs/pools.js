import { usd, qty, pct, cls, donut, COLORS } from '../format.js';
import { MOCK_POOLS } from '../mock-data.js';

let sel = 0, last = null;

function analyse(p, prices) {
  const pb = prices[p.base]?.usd, pq = prices[p.quote]?.usd;
  const price = pb && pq ? pb / pq : null;
  const tokens = Object.entries(p.amounts).map(([s, a]) => ({ s, a, v: a * (prices[s]?.usd ?? 0) }));
  const total = tokens.reduce((t, x) => t + x.v, 0) || 1;
  let status = 'En rango', tone = 'ok';
  if (price == null) { status = 'Sin precio del par'; tone = 'none'; }
  else if (price < p.min) { status = `Fuera de rango - 100% ${p.base}`; tone = 'out'; }
  else if (price > p.max) { status = `Fuera de rango - 100% ${p.quote}`; tone = 'out'; }
  const edge = (p.max - p.min) * 0.1;
  const color = tone === 'none' ? '#94a3b8' : tone === 'out' ? '#ef4444' : (price - p.min < edge || p.max - price < edge) ? '#fbbf24' : '#22c55e';
  const roiPct = p.roiUsd / p.invested * 100;
  return { ...p, price, tokens, total, status, color, roiPct, apr: roiPct * 365 / p.days, ilPct: p.ilUsd / p.invested * 100 };
}

export function render(ctx) {
  last = ctx;
  const pools = MOCK_POOLS.map(p => analyse(p, ctx.market.prices));
  sel = Math.min(sel, pools.length - 1);
  const s = pools[sel];

  const lo = s.min - (s.max - s.min) * 0.3, hi = s.max + (s.max - s.min) * 0.3, at = v => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
  const expo = {};
  pools.forEach(p => p.tokens.forEach(t => (expo[t.s] = (expo[t.s] || 0) + t.v)));

  const root = document.getElementById('pools-root');
  root.innerHTML = `
    <div class="card scroll-x">
      <input id="pool-filter" class="inp mb-3 max-w-xs" placeholder="Filtrar por par o protocolo">
      <table class="tbl"><thead><tr><th>Par / Protocolo</th><th>Estado</th><th>Composición</th><th class="r">IL</th><th class="r">Tiempo</th><th class="r">ROI neto</th></tr></thead>
      <tbody>${pools.map((p, i) => `<tr data-i="${i}" data-q="${(p.pair + p.protocol).toLowerCase()}" class="cursor-pointer ${i === sel ? 'bg-[#11131f]' : ''}">
        <td><div class="font-medium">${p.pair}</div><div class="label">${p.protocol} · ${p.network}</div></td>
        <td><span style="color:${p.color}">${p.status}</span></td>
        <td class="num">${p.tokens.map(t => `${qty(t.a)} ${t.s} (${pct(t.v / p.total * 100)})`).join('<br>')}</td>
        <td class="num r ${cls(p.ilUsd)}">${usd(p.ilUsd)}<br>${pct(p.ilPct, 2)}</td>
        <td class="num r">${p.days} d</td>
        <td class="num r ${cls(p.roiUsd)}">${usd(p.roiUsd)}<br>${pct(p.roiPct, 2)} · ${pct(p.apr, 1)} anual</td></tr>`).join('')}</tbody></table>
      <p class="label mt-3">Pools de ejemplo (se conectarán a TrackDeFi más adelante). Pulsa una fila para ver su rango.</p>
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="card"><h2 class="mb-4 font-semibold">Rango de ${s.pair}</h2>
        <div class="relative h-3 rounded bg-[#11131f]">
          <div class="absolute h-3 rounded opacity-40" style="left:${at(s.min)}%;width:${at(s.max) - at(s.min)}%;background:${s.color}"></div>
          <div class="absolute -top-1 h-5 w-1 rounded" style="left:calc(${at(s.price ?? lo)}% - 2px);background:${s.color}"></div></div>
        <div class="num mt-3 flex justify-between text-xs"><span>mín ${usd(s.min)}</span><span style="color:${s.color}">actual ${s.price == null ? '—' : usd(s.price)}</span><span>máx ${usd(s.max)}</span></div></div>
      <div class="card"><h2 class="mb-4 font-semibold">Exposición por activo</h2>
        ${donut(Object.entries(expo).map(([label, value], i) => ({ label, value, color: COLORS[i % 6] })))}</div>
    </div>`;

  root.querySelector('tbody').onclick = e => {
    const tr = e.target.closest('tr'); if (tr) { sel = +tr.dataset.i; render(last); }
  };
  root.querySelector('#pool-filter').oninput = e => {
    const q = e.target.value.toLowerCase();
    root.querySelectorAll('tbody tr').forEach(tr => (tr.hidden = !tr.dataset.q.includes(q)));
  };
}
