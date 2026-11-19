import { loadMetrics, halvingInfo } from '../bitview.js';
import { lineChart, thin } from '../charts.js';
import { usd, pct, fmt, cls, esc } from '../format.js';

let st = { status: 'idle' }, range = '4y', etf = null;
const DAY = 864e5;
const RANGES = { '90d': 90, '1y': 365, '4y': 1460, Todo: Infinity };
const ETF_URL = 'https://axeladlerjr.com/charts/bitcoin-etf-flow-monitor/';
const ETF_EMBED = ETF_URL + 'embed.html'; // código de incrustación oficial de Axel Adler Jr
const dateEs = t => new Date(t).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
const unavailable = '<div class="label p-6">No disponible: la fuente no devolvió estos datos.</div>';

/** Carga las métricas la primera vez que se abre la pestaña */
export function ensure() {
  if (st.status !== 'idle') return;
  st = { status: 'loading' };
  loadEtf();
  render();
  loadMetrics()
    .then(data => { st = { status: 'ready', data }; render(); })
    .catch(e => { st = { status: 'error', error: e.message }; render(); });
}

/** Resumen de ETFs (flujo del día, semana, precio implícito): lo escribe data/etf.json el proceso diario de GitHub */
function loadEtf() {
  fetch('data/etf.json?v=' + Date.now()).then(r => (r.ok ? r.json() : null)).then(j => {
    if (j && Number.isFinite(j.lastDay)) { etf = j; if (st.status === 'ready') render(); }
  }).catch(() => {});
}

/** Zonas del ciclo, en días desde el último halving: máximos 370–540; mínimos 267–406 tras el ATH; entre ambas, alcista o bajista */
function halvingZones(hv, athT) {
  const len = hv.elapsedDays + hv.remainingDays;
  const zones = [{ k: 'max', a: 370, b: 540 }];
  if (athT) { const A = (athT - hv.prevDate) / DAY; zones.push({ k: 'min', a: A + 267, b: A + 406 }); }
  const lab = x => {
    const z = zones.find(q => x >= q.a && x < q.b);
    if (z) return z.k;
    const done = zones.filter(q => q.b <= x).sort((p, q) => q.b - p.b)[0];
    if (done) return done.k === 'min' ? 'up' : 'down';
    return zones.slice().sort((p, q) => p.a - q.a)[0].k === 'max' ? 'up' : 'down';
  };
  const segs = [];
  for (let x = 0; x < len; x++) {
    const k = lab(x + 0.5), last = segs.at(-1);
    if (last && last.k === k) last.b = Math.min(len, x + 1); else segs.push({ k, a: x, b: Math.min(len, x + 1) });
  }
  return { len, segs, cur: lab(hv.elapsedDays) };
}
const ZC = { max: ['#ef4444', 'Zona de máximos'], min: ['#22c55e', 'Zona de mínimos'], up: ['#38bdf8', 'Zona alcista'], down: ['#f59e0b', 'Zona bajista'] };

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
  // Señales: verde = zona de compra, rojo = zona de venta
  const ok = v => Number.isFinite(v), sig = (buy, sell) => (buy ? 'buy' : sell ? 'sell' : '');
  const S = {
    mvrv: ok(L.mvrv) ? sig(L.mvrv < 1, L.mvrv > 2.5) : '',
    realized: ok(L.price) && ok(L.realized) ? sig(L.price < L.realized, L.price > 2 * L.realized) : '',
    ma: ok(L.price) && ok(L.ma200) ? sig(L.price < L.ma200, L.price > 2 * L.ma200) : '',
    rsi: ok(L.rsi) ? sig(L.rsi < 30, L.rsi > 75) : '',
  };
  const SIG = { buy: ['#22c55e', 'Comprar'], sell: ['#ef4444', 'Vender'] };
  const stat = (label, value, sub = '', tone = '', s = '') => { const c = SIG[s]; return `<div class="card" ${c ? `style="border-color:${c[0]};background:${c[0]}1f"` : ''}><div class="label">${label}${c ? ` <b style="color:${c[0]}">· ${c[1]}</b>` : ''}</div><div class="num text-xl ${tone}" ${c ? `style="color:${c[0]}"` : ''}>${value}</div><div class="label">${sub}</div></div>`; };
  const card = (title, note, body) => `<div class="card"><h2 class="font-semibold">${title}</h2><p class="label mb-3">${note}</p>${body}</div>`;

  const hv = d.tip ? halvingInfo(d.tip) : null;
  let zoneHtml = '';
  if (hv) {
    const z = halvingZones(hv, d.ath.t), at = x => dateEs(hv.prevDate + x * DAY), inSeg = s => s.a <= hv.elapsedDays && hv.elapsedDays < s.b;
    zoneHtml = `
    <div class="relative h-4 overflow-hidden rounded">${z.segs.map(s => `<div class="absolute inset-y-0" data-tip="${esc(`<b>${ZC[s.k][1]}</b><br>${at(s.a)} → ${at(s.b)}`)}" style="left:${(s.a / z.len * 100).toFixed(2)}%;width:${((s.b - s.a) / z.len * 100).toFixed(2)}%;background:${ZC[s.k][0]};opacity:.55"></div>`).join('')}
      <div class="absolute inset-y-0 w-0.5 bg-white" style="left:${Math.min(100, hv.elapsedDays / z.len * 100).toFixed(2)}%"></div></div>
    <div class="mt-2 text-sm">Ahora: <b style="color:${ZC[z.cur][0]}">${ZC[z.cur][1]}</b> · día ${fmt(Math.round(hv.elapsedDays))} del ciclo</div>
    <div class="mt-1 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">${z.segs.map(s => `<div style="${inSeg(s) ? 'font-weight:600' : 'color:#94a3b8'}"><i style="display:inline-block;width:.7rem;height:.7rem;margin-right:.4rem;border-radius:2px;background:${ZC[s.k][0]}"></i>${ZC[s.k][1]}: <span class="num">${at(s.a)} → ${at(s.b)}</span></div>`).join('')}</div>`;
  }
  const halving = hv ? `${zoneHtml}
    <div class="relative mt-3 h-3 rounded bg-[#11131f]">
      <div class="absolute h-3 rounded bg-[#f7931a] opacity-60" style="width:${hv.progress.toFixed(2)}%"></div>
      <div class="absolute -top-1 h-5 w-1 rounded bg-[#38bdf8]" style="left:calc(${hv.progress.toFixed(2)}% - 2px)"></div></div>
    <div class="num mt-3 flex justify-between text-xs"><span>Anterior · ${dateEs(hv.prevDate)}<br>bloque ${fmt(hv.prevH)}</span><span class="text-center text-[#38bdf8]">${pct(hv.progress, 1)}<br>bloque ${fmt(hv.tip)}</span><span class="text-right">Próximo (est.) · ${dateEs(hv.nextDate)}<br>bloque ${fmt(hv.nextH)}</span></div>
    <div class="mt-3 flex gap-6"><div><div class="label">Días transcurridos</div><div class="num text-xl">${fmt(Math.round(hv.elapsedDays))}</div></div>
      <div><div class="label">Días restantes (est.)</div><div class="num text-xl">${fmt(Math.round(hv.remainingDays))}</div></div>
      <div><div class="label">Bloques restantes</div><div class="num text-xl">${fmt(hv.remBlocks)}</div></div></div>` : '<div class="label p-6">No disponible: no se pudo leer la altura de bloque actual.</div>';

  const athCard = `<div class="card"><div class="label">Caída desde máximos (ATH)</div>
    <div class="num text-xl ${dd < 0 ? 'neg' : ''}">${dd == null ? '—' : pct(dd, 1)}</div>
    <div class="relative my-1 h-2 rounded bg-[#11131f]"><div class="absolute h-2 rounded bg-[#ef4444] opacity-70" style="width:${dd == null ? 0 : Math.min(100, Math.max(0, -dd)).toFixed(1)}%"></div></div>
    <div class="label">${d.ath.value ? `máx. ${usd(d.ath.value)} · ${dateEs(d.ath.t)}` : ''}</div></div>`;

  const mUsd = v => `${v < 0 ? '−' : '+'}${fmt(Math.abs(v) / 1e6, { maximumFractionDigits: 1 })} M$`;
  const etfCard = etf ? `<div class="card"><div class="flex flex-wrap items-baseline justify-between gap-2"><h2 class="font-semibold">ETFs de Bitcoin (EE. UU., spot)</h2><span class="label">datos del ${dateEs(Date.parse(etf.asOf))}</span></div>
      <div class="mt-2 grid grid-cols-3 gap-3">
        <div><div class="label">Flujo del día</div><div class="num text-xl ${cls(etf.lastDay)}">${mUsd(etf.lastDay)}</div></div>
        <div><div class="label">Flujo de la semana</div><div class="num text-xl ${cls(etf.week)}">${mUsd(etf.week)}</div><div class="label">sesiones completas</div></div>
        <div><div class="label">Precio medio implícito</div><div class="num text-xl">${usd(etf.impliedPrice)}</div><div class="label">flujos netos USD ÷ BTC${L.price ? ` · BTC ${pct((L.price / etf.impliedPrice - 1) * 100, 1)} vs implícito` : ''}</div></div></div></div>`
    : '<div class="card"><h2 class="font-semibold">ETFs de Bitcoin (EE. UU., spot)</h2><p class="label">Resumen no disponible todavía: lo actualiza el proceso diario de GitHub. El gráfico completo está más abajo.</p></div>';
  root.innerHTML = `
    <div class="flex flex-wrap items-center gap-2"><h2 class="mr-auto font-semibold">RESUMEN</h2>
      ${Object.keys(RANGES).map(r => `<button class="btn ${r === range ? '' : 'btn-ghost'}" data-mrange="${r}" type="button">${r}</button>`).join('')}</div>
    ${d.errors.length ? `<p class="neg text-sm">No se pudo leer: ${d.errors.join(', ')}.</p>` : ''}
    ${etfCard}
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
      ${stat('MVRV', L.mvrv ? fmt(L.mvrv, { maximumFractionDigits: 2 }) : '—', 'precio ÷ precio realizado', '', S.mvrv)}
      ${stat('Precio realizado', L.realized ? usd(L.realized) : '—', 'coste medio on-chain', '', S.realized)}
      ${stat('Precio / media 200 sem.', ratio ? fmt(ratio, { maximumFractionDigits: 2 }) + '×' : '—', L.ma200 ? 'media: ' + usd(L.ma200) : '', '', S.ma)}
      ${stat('RSI diario (14)', L.rsi != null ? fmt(L.rsi, { maximumFractionDigits: 1 }) : '—', L.rsi > 75 ? 'sobrecompra' : L.rsi < 30 ? 'sobreventa' : 'zona neutral', '', S.rsi)}
      ${athCard}
    </div>
    <p class="label">Verde = zona de compra · Rojo = zona de venta.</p>
    ${card('Ciclo de halvings', 'Cada 210.000 bloques (la fecha del próximo es una estimación a 10 min por bloque). Franja de color: zonas del ciclo según días desde el halving (máximos 370–540) y desde el máximo histórico (mínimos 267–406).', halving)}
    ${card('Precio y precio realizado', 'El precio realizado es el coste medio de todas las monedas en su último movimiento.', has(d.realized)
      ? lineChart({ log: true, series: [{ label: 'Precio BTC', color: '#f7931a', pts: points(d, d.price) }, { label: 'Precio realizado', color: '#38bdf8', pts: points(d, d.realized) }] }) : unavailable)}
    ${card('MVRV', 'Precio de mercado ÷ precio realizado. Por debajo de 1, el mercado cotiza bajo el coste medio on-chain.', has(d.mvrv)
      ? lineChart({ series: [{ label: 'MVRV', color: '#22c55e', pts: points(d, d.mvrv) }], lines: [{ y: 1, label: '1,0' }], yfmt: v => fmt(v, { maximumFractionDigits: 2 }) }) : unavailable)}
    ${card('Media móvil de 200 semanas', 'Media de los últimos 1.400 días de precio: soporte histórico de largo plazo.', has(d.ma200)
      ? lineChart({ log: true, series: [{ label: 'Precio BTC', color: '#f7931a', pts: points(d, d.price) }, { label: 'Media 200 semanas', color: '#a78bfa', pts: points(d, d.ma200) }] }) : unavailable)}
    ${card('RSI diario de 14 días', 'Calculado en tu navegador con los precios de cierre diarios (método de Wilder).', has(d.rsi)
      ? lineChart({ domain: [0, 100], series: [{ label: 'RSI 14', color: '#fbbf24', pts: points(d, d.rsi) }], lines: [{ y: 70, label: '70' }, { y: 30, label: '30' }], height: 180, yfmt: v => fmt(v, { maximumFractionDigits: 0 }) }) : unavailable)}
    ${card('Flujos netos de ETFs de Bitcoin', 'Gráfico de Axel Adler Jr, incrustado desde su web.', `
      <iframe src="${ETF_EMBED}" width="100%" height="640" style="border:0" loading="lazy" title="Bitcoin ETF Flows"></iframe>
      <p class="label mt-2">Fuente: <a class="text-[#38bdf8] underline" href="${ETF_URL}" target="_blank" rel="noopener noreferrer">Bitcoin ETF Flows</a> (axeladlerjr.com).</p>`)}
    <p class="label">Datos on-chain: Bitview (bitview.space), licencia CC BY 4.0. Gráficos ETF: axeladlerjr.com. MVRV, media de 200 semanas y RSI se calculan localmente.</p>`;

  root.querySelectorAll('[data-mrange]').forEach(el => (el.onclick = () => { range = el.dataset.mrange; render(); }));
}
