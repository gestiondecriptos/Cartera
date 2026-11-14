import { loadMetrics, halvingInfo } from '../metrics.js';
import { lineChart, thin } from '../charts.js';
import { usd, pct, fmt } from '../format.js';

let st = { status: 'idle' }, range = '4y';
const RANGES = { '90d': 90, '1y': 365, '4y': 1460, Todo: Infinity };
const ETF_URL = 'https://axeladlerjr.com/charts/bitcoin-etf-flow-monitor/';
const dateEs = t => new Date(t).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
const unavailable = '<div class="label p-6">No disponible: la fuente no devolvió estos datos.</div>';

/** Carga las métricas la primera vez que se abre la pestaña */
export function ensure() {
  if (st.status !== 'idle') return;
  st = { status: 'loading' };
  render();
  loadMetrics()
    .then(data => { st = { status: 'ready', data }; render(); })
    .catch(e => { st = { status: 'error', error: e.message }; render(); });
}

function points(d, arr) {
  const from = RANGES[range] === Infinity ? 0 : Date.now() - RANGES[range] * 864e5, out = [];
  for (let i = 0; i < d.t.length; i++) if (d.t[i] >= from) out.push([d.t[i], arr[i]]);
  return thin(out);
}
const has = arr => arr.some(v => v != null);

export function render() {
  const root = document.getElementById('metrics-root');
  if (!root) return;
  if (st.status === 'idle' || st.status === 'loading') { root.innerHTML = '<div class="card label">Cargando métricas de Bitview…</div>'; return; }
  if (st.status === 'error') {
    root.innerHTML = `<div class="card"><p class="neg">${st.error}</p><button id="m-retry" class="btn mt-3" type="button">Reintentar</button></div>`;
    root.querySelector('#m-retry').onclick = () => { st = { status: 'idle' }; ensure(); };
    return;
  }

  const d = st.data, L = d.last;
  const dd = d.ath.value ? (L.price / d.ath.value - 1) * 100 : null;
  const ratio = L.ma200 ? L.price / L.ma200 : null;
  const stat = (label, value, sub = '', tone = '') => `<div class="card"><div class="label">${label}</div><div class="num text-xl ${tone}">${value}</div><div class="label">${sub}</div></div>`;
  const card = (title, note, body) => `<div class="card"><h2 class="font-semibold">${title}</h2><p class="label mb-3">${note}</p>${body}</div>`;

  const hv = d.tip ? halvingInfo(d.tip) : null;
  const halving = hv ? `
    <div class="relative mt-6 h-3 rounded bg-[#11131f]">
      <div class="absolute h-3 rounded bg-[#f7931a] opacity-60" style="width:${hv.progress.toFixed(2)}%"></div>
      <div class="absolute -top-1 h-5 w-1 rounded bg-[#38bdf8]" style="left:calc(${hv.progress.toFixed(2)}% - 2px)"></div></div>
    <div class="num mt-3 flex justify-between text-xs"><span>Anterior · ${dateEs(hv.prevDate)}<br>bloque ${fmt(hv.prevH)}</span><span class="text-center text-[#38bdf8]">${pct(hv.progress, 1)}<br>bloque ${fmt(hv.tip)}</span><span class="text-right">Próximo (est.) · ${dateEs(hv.nextDate)}<br>bloque ${fmt(hv.nextH)}</span></div>
    <div class="mt-3 flex gap-6"><div><div class="label">Días transcurridos</div><div class="num text-xl">${fmt(Math.round(hv.elapsedDays))}</div></div>
      <div><div class="label">Días restantes (est.)</div><div class="num text-xl">${fmt(Math.round(hv.remainingDays))}</div></div>
      <div><div class="label">Bloques restantes</div><div class="num text-xl">${fmt(hv.remBlocks)}</div></div></div>` : '<div class="label p-6">No disponible: no se pudo leer la altura de bloque actual.</div>';

  root.innerHTML = `
    <div class="flex flex-wrap items-center gap-2"><h2 class="mr-auto font-semibold">Rango de los gráficos</h2>
      ${Object.keys(RANGES).map(r => `<button class="btn ${r === range ? '' : 'btn-ghost'}" data-mrange="${r}" type="button">${r}</button>`).join('')}</div>
    ${d.errors.length ? `<p class="neg text-sm">No se pudo leer: ${d.errors.join(', ')}.</p>` : ''}
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
      ${stat('MVRV', L.mvrv ? fmt(L.mvrv, { maximumFractionDigits: 2 }) : '—', 'precio ÷ precio realizado')}
      ${stat('Precio realizado', L.realized ? usd(L.realized) : '—', 'coste medio on-chain')}
      ${stat('Precio / media 200 sem.', ratio ? fmt(ratio, { maximumFractionDigits: 2 }) + '×' : '—', L.ma200 ? 'media: ' + usd(L.ma200) : '')}
      ${stat('RSI diario (14)', L.rsi != null ? fmt(L.rsi, { maximumFractionDigits: 1 }) : '—', L.rsi >= 70 ? 'sobrecompra' : L.rsi <= 30 ? 'sobreventa' : 'zona neutral')}
      ${stat('Caída desde máximo', dd == null ? '—' : pct(dd, 1), 'máx. ' + (d.ath.value ? usd(d.ath.value) : '—'), dd < 0 ? 'neg' : '')}
    </div>
    ${card('Precio y precio realizado', 'El precio realizado es el coste medio de todas las monedas en su último movimiento.', has(d.realized)
      ? lineChart({ log: true, series: [{ label: 'Precio BTC', color: '#f7931a', pts: points(d, d.price) }, { label: 'Precio realizado', color: '#38bdf8', pts: points(d, d.realized) }] }) : unavailable)}
    ${card('MVRV', 'Precio de mercado ÷ precio realizado. Por debajo de 1, el mercado cotiza bajo el coste medio on-chain.', has(d.mvrv)
      ? lineChart({ series: [{ label: 'MVRV', color: '#22c55e', pts: points(d, d.mvrv) }], lines: [{ y: 1, label: '1,0' }], yfmt: v => fmt(v, { maximumFractionDigits: 2 }) }) : unavailable)}
    ${card('Media móvil de 200 semanas', 'Media de los últimos 1.400 días de precio: soporte histórico de largo plazo.', has(d.ma200)
      ? lineChart({ log: true, series: [{ label: 'Precio BTC', color: '#f7931a', pts: points(d, d.price) }, { label: 'Media 200 semanas', color: '#a78bfa', pts: points(d, d.ma200) }] }) : unavailable)}
    ${card('RSI diario de 14 días', 'Calculado en tu navegador con los precios de cierre diarios (método de Wilder).', has(d.rsi)
      ? lineChart({ domain: [0, 100], series: [{ label: 'RSI 14', color: '#fbbf24', pts: points(d, d.rsi) }], lines: [{ y: 70, label: '70' }, { y: 30, label: '30' }], height: 180, yfmt: v => fmt(v, { maximumFractionDigits: 0 }) }) : unavailable)}
    <div class="grid gap-4 lg:grid-cols-2">
      ${card('Caída desde máximos (ATH)', d.ath.value ? `Máximo histórico del ${dateEs(d.ath.t)}.` : '', dd == null ? unavailable : `
        <div class="num text-3xl ${dd < 0 ? 'neg' : ''}">${pct(dd, 1)}</div>
        <div class="relative mt-3 h-3 rounded bg-[#11131f]"><div class="absolute h-3 rounded bg-[#ef4444] opacity-70" style="width:${Math.min(100, Math.max(0, -dd)).toFixed(1)}%"></div></div>
        <div class="num mt-2 flex justify-between text-xs"><span>${usd(L.price)}</span><span>máx ${usd(d.ath.value)}</span></div>`)}
      ${card('Ciclo de halvings', 'Cada 210.000 bloques. La fecha del próximo halving es una estimación (10 min por bloque).', halving)}
    </div>
    ${card('Flujos netos de ETFs de Bitcoin', 'Gráfico de Axel Adler Jr, incrustado desde su web.', `
      <iframe src="${ETF_URL}" title="Flujos de ETFs de Bitcoin (Axel Adler Jr)" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin" class="w-full rounded border border-[#2d3142]" style="height:640px"></iframe>
      <p class="label mt-2">Si el recuadro aparece vacío, esa web no permite incrustarlo: <a class="text-[#38bdf8] underline" href="${ETF_URL}" target="_blank" rel="noopener noreferrer">ábrelo aquí</a>.</p>`)}
    <p class="label">Datos on-chain: Bitview (bitview.space), licencia CC BY 4.0. Gráficos ETF: axeladlerjr.com. MVRV, media de 200 semanas y RSI se calculan localmente.</p>`;

  root.querySelectorAll('[data-mrange]').forEach(el => (el.onclick = () => { range = el.dataset.mrange; render(); }));
}
