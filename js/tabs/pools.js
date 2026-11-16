import { usd, qty, pct, cls, esc, donut, COLORS } from '../format.js';
import { normalizeSymbol, poolPerformance } from '../accounting.js';

let sel = 0, last = null;
const SRC = {
  none: 'No se pudieron leer los pools (TrackDeFi no responde). No están incluidos en el patrimonio.',
  partial: 'Algunas direcciones no se pudieron leer: la lista puede estar incompleta.',
};

// Márgenes respecto al rango (en %), para ver cuánto falta para salirse o cuánto se ha salido
function marginText(r) {
  const { lower, upper, current } = r, p = x => pct(Math.abs(x), 1);
  if (current > upper) return `<span class="neg">Fuera de rango: ${p((current / upper - 1) * 100)} por encima del máximo.</span> Vuelve a entrar si el precio baja un ${p((1 - upper / current) * 100)}.`;
  if (current < lower) return `<span class="neg">Fuera de rango: ${p((1 - current / lower) * 100)} por debajo del mínimo.</span> Vuelve a entrar si el precio sube un ${p((lower / current - 1) * 100)}.`;
  const at = upper > lower ? (current - lower) / (upper - lower) * 100 : 50;
  return `Posición en el rango: <b>${pct(at, 0)}</b> (0% = mínimo · 100% = máximo)<br>Margen hasta el mínimo: <b>−${p((1 - lower / current) * 100)}</b> · hasta el máximo: <b>+${p((upper / current - 1) * 100)}</b>`;
}

export function render(ctx) {
  last = ctx;
  const { positions, source, fetchedAt, warnings } = ctx.market.pools;
  const root = document.getElementById('pools-root');
  sel = Math.min(sel, Math.max(0, positions.length - 1));
  const s = positions[sel];

  const fileNote = source === 'file' ? `Datos guardados por el workflow${fetchedAt ? ` (${fetchedAt.slice(0, 16).replace('T', ' ')} UTC)` : ''}: el navegador no pudo consultar TrackDeFi directamente.` : '';
  const notes = [SRC[source], fileNote].filter(Boolean);

  // exposición por activo (WBNB cuenta como BNB, etc.)
  const expo = {};
  positions.forEach(p => p.tokens.forEach(t => { const k = normalizeSymbol(t.symbol).symbol; expo[k] = (expo[k] || 0) + t.valueUsd; }));

  const lo = s?.range ? s.range.lower - (s.range.upper - s.range.lower) * 0.3 : 0, hi = s?.range ? s.range.upper + (s.range.upper - s.range.lower) * 0.3 : 1;
  const at = v => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
  const fmtR = v => (Math.abs(v) >= 1000 ? usd(v).replace(/US\$|\$/, '').trim() : v.toLocaleString('es-ES', { maximumSignificantDigits: 5 }));

  root.innerHTML = `
    ${notes.map(n => `<div class="card text-sm" style="border-color:#fbbf24">${n}</div>`).join('')}
    <div class="card scroll-x">
      <input id="pool-filter" class="inp mb-3 max-w-xs" placeholder="Filtrar por par o protocolo">
      ${positions.length ? `<table class="tbl"><thead><tr><th>Par / Protocolo</th><th>Estado</th><th>Composición</th><th class="r">Valor</th><th class="r">Comisiones pendientes</th><th class="r">IL</th><th class="r">Tiempo</th><th class="r">ROI neto</th></tr></thead>
      <tbody>${positions.map((p, i) => `<tr data-i="${i}" data-q="${(p.pair + p.protocol + p.network).toLowerCase()}" class="cursor-pointer ${i === sel ? 'bg-[#11131f]' : ''}">
        <td><div class="font-medium">${p.pair}</div><div class="label">${p.protocol} · ${p.network}${p.staked ? ' · staked' : ''}</div><div class="label">id <span class="num">${p.id}</span></div></td>
        <td><span style="color:${p.color}">${p.status}</span></td>
        <td class="num">${p.tokens.map(t => `${qty(t.amount)} ${t.symbol} (${pct(p.valueUsd ? t.valueUsd / p.valueUsd * 100 : 0)})`).join('<br>')}</td>
        <td class="num r">${usd(p.valueUsd)}</td>
        <td class="num r">${usd(p.rewardsUsd)}</td>
        ${(perf => perf ? `<td class="num r ${cls(perf.ilUsd ?? 0)}">${perf.ilUsd == null ? '—' : usd(perf.ilUsd) + '<br>' + pct(perf.ilPct, 2)}</td><td class="num r">${Math.round(perf.days)} d</td><td class="num r ${cls(perf.roiUsd)}">${usd(perf.roiUsd)}<br>${pct(perf.roiPct, 2)} · ${pct(perf.annualPct, 1)} anual</td>` : '<td class="num r label">—</td><td class="num r label">—</td><td class="num r label">—</td>')(poolPerformance(p, ctx.state?.poolEntries?.[p.id]))}</tr>`).join('')}</tbody></table>`
        : '<p class="label">No hay posiciones.</p>'}
      <p class="label mt-3">Fuente: TrackDeFi. IL, tiempo y ROI se calculan con la entrada que pongas en data/manual.js (sección poolEntries, con el id que ves bajo cada pool; la pestaña «Datos manuales» te da las líneas listas para copiar) (ROI = valor + comisiones pendientes − invertido; IL = valor actual − valor de mantener los tokens iniciales). Pulsa una fila para ver su rango.</p>
      ${warnings?.length ? `<details class="label mt-2"><summary class="cursor-pointer">TrackDeFi no pudo consultar ${warnings.length} fuentes (por ejemplo pools Uniswap V2 en algunas redes). Si tienes posiciones ahí, podrían faltar.</summary><ul class="mt-1 list-disc pl-5">${warnings.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="card"><h2 class="mb-4 font-semibold">Rango${s ? ` de ${s.pair}` : ''}</h2>
        ${s?.range ? `<div class="relative h-3 rounded bg-[#11131f]">
          <div class="absolute h-3 rounded opacity-40" style="left:${at(s.range.lower)}%;width:${at(s.range.upper) - at(s.range.lower)}%;background:${s.color}"></div>
          <div class="absolute -top-1 h-5 w-1 rounded" style="left:calc(${at(s.range.current)}% - 2px);background:${s.color}"></div></div>
          <div class="num mt-3 flex justify-between text-xs"><span>mín ${fmtR(s.range.lower)}</span><span style="color:${s.color}">actual ${fmtR(s.range.current)}</span><span>máx ${fmtR(s.range.upper)}</span></div>
          <div class="label mt-1">Precio en ${s.range.quoteLabel}</div>
          <div class="num mt-3 text-sm">${marginText(s.range)}</div>` : '<div class="label">Esta posición no tiene rango (pool V2) o no hay posiciones.</div>'}</div>
      <div class="card"><h2 class="mb-4 font-semibold">Exposición por activo</h2>
        ${Object.keys(expo).length ? donut(Object.entries(expo).map(([label, value], i) => ({ label, value, color: COLORS[i % 6] }))) : '<div class="label">Sin datos</div>'}</div>
    </div>`;

  const tb = root.querySelector('tbody');
  if (tb) tb.onclick = e => { const tr = e.target.closest('tr'); if (tr) { sel = +tr.dataset.i; render(last); } };
  root.querySelector('#pool-filter').oninput = e => {
    const q = e.target.value.toLowerCase();
    root.querySelectorAll('tbody tr').forEach(tr => (tr.hidden = !tr.dataset.q.includes(q)));
  };
}
