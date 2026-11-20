import { loadMetrics, halvingInfo } from '../bitview.js';
import { lineChart, thin, axisChart } from '../charts.js';
import { usd, pct, fmt, cls, esc } from '../format.js';

let st = { status: 'idle' }, range = '4y', etf = null, fng = null, rbw = null, liq = null, cgl = null;
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
  loadExtras();
  render();
  loadMetrics()
    .then(data => { st = { status: 'ready', data }; render(); })
    .catch(e => { st = { status: 'error', error: e.message }; render(); });
}

/** Datos extra (ETF, Fear & Greed, Rainbow, liquidaciones): los escribe el proceso diario de GitHub en data/*.json */
function loadJson(name, set) {
  fetch(`data/${name}.json?v=${Date.now()}`).then(r => (r.ok ? r.json() : null)).then(j => { if (j) { set(j); if (st.status === 'ready') render(); } }).catch(() => {});
}
function loadExtras() {
  loadJson('etf', j => { if (Number.isFinite(j.lastDay)) etf = j; });
  loadJson('fng', j => { if (j.cg && Number.isFinite(j.cg.value)) fng = j; });
  loadJson('rainbow', j => { if (j.band && j.index) rbw = j; });
  loadJson('liq', j => { if (Number.isFinite(j.longs5)) liq = j; });
  loadJson('cgliq', j => { cgl = j; });
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
const ZC = { max: ['#22c55e', 'Zona de máximos'], min: ['#ef4444', 'Zona de mínimos'], up: ['#38bdf8', 'Zona alcista'], down: ['#f59e0b', 'Zona bajista'] };

const FNG_ZONES = [[0, 30, '#ef4444'], [30, 45, '#f97316'], [45, 55, '#eab308'], [55, 70, '#84cc16'], [70, 100, '#22c55e']];
const FNG_ES = { 'Extreme Fear': 'Miedo extremo', Fear: 'Miedo', Neutral: 'Neutral', Greed: 'Codicia', 'Extreme Greed': 'Codicia extrema' };
const fngColor = v => (FNG_ZONES.find(z => v <= z[1]) || FNG_ZONES.at(-1))[2];
/** Velocímetro semicircular con zonas de color (rojo = miedo extremo → verde = codicia extrema) */
function gaugeSvg(v) {
  const cx = 100, cy = 100, r = 78, P = (x, rr = r) => { const a = Math.PI * (1 - x / 100); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
  const arcs = FNG_ZONES.map(([a, b, c]) => { const [x1, y1] = P(a), [x2, y2] = P(b); return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="${c}" stroke-width="16"/>`; }).join('');
  const [nx, ny] = P(v, r - 14);
  return `<svg viewBox="0 0 200 126" class="mx-auto w-full" style="max-width:280px" role="img" aria-label="Fear and Greed ${v}">${arcs}<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="5" fill="#e2e8f0"/><text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="22" font-weight="700" fill="#e2e8f0">${v}</text><text x="12" y="118" font-size="8" fill="#94a3b8">Miedo extremo</text><text x="188" y="118" text-anchor="end" font-size="8" fill="#94a3b8">Codicia extrema</text></svg>`;
}
const RBW = [['Deep discount', 'Descuento profundo', '#6d28d9'], ['Discount', 'Descuento', '#2563eb'], ['Below trend', 'Bajo la tendencia', '#0ea5e9'], ['Slightly below trend', 'Algo bajo la tendencia', '#14b8a6'], ['Near trend', 'Cerca de la tendencia', '#22c55e'], ['Above trend', 'Sobre la tendencia', '#eab308'], ['Stretched', 'Estirado', '#f59e0b'], ['Overheated', 'Sobrecalentado', '#f97316'], ['Extreme', 'Extremo', '#ef4444']];

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

  const noData = t => `<div class="card"><h2 class="font-semibold">${t}</h2><p class="label">Sin datos todavía: los rellena el proceso diario de GitHub.</p></div>`;
  const cgf = fng && fng.cg;
  const fngCard = cgf ? `<div class="card"><div class="flex flex-wrap items-baseline justify-between gap-2"><h2 class="font-semibold">Fear &amp; Greed (CoinGecko)</h2><span class="label">${cgf.asOf || ''}</span></div>
      ${gaugeSvg(cgf.value)}
      <div class="text-center"><b style="color:${fngColor(cgf.value)}">${FNG_ES[cgf.label] || cgf.label || ''}</b>${cgf.streak ? ` · ${cgf.streak} días seguidos` : ''}</div>
      <div class="num mt-2 grid grid-cols-3 gap-2 text-center text-xs">${[['Ayer', cgf.yesterday], ['Hace 1 semana', cgf.lastWeek], ['Hace 1 mes', cgf.lastMonth]].map(([k, v]) => `<div><div class="label">${k}</div><b style="color:${v == null ? '#94a3b8' : fngColor(v)}">${v == null ? '—' : v}</b></div>`).join('')}</div></div>` : noData('Fear &amp; Greed (CoinGecko)');
  const rbwCard = rbw ? `<div class="card"><div class="flex flex-wrap items-baseline justify-between gap-2"><h2 class="font-semibold">Rainbow Chart</h2><span class="label">${rbw.asOf || ''}</span></div>
      <div class="relative mt-6"><div class="absolute text-xs" style="left:${((rbw.index - 0.5) / 9 * 100).toFixed(2)}%;top:-18px;transform:translateX(-50%);color:${RBW[rbw.index - 1][2]}">▼</div>
        <div class="flex h-4 overflow-hidden rounded">${RBW.map(([, es, c], i) => `<div class="flex-1" data-tip="${esc(`<b>${es}</b><br>banda ${i + 1} de 9`)}" style="background:${c};opacity:${i + 1 === rbw.index ? 1 : 0.4}"></div>`).join('')}</div></div>
      <div class="mt-2 text-sm">Banda ${rbw.index} de 9: <b style="color:${RBW[rbw.index - 1][2]}">${RBW[rbw.index - 1][1]}</b></div>
      <div class="num mt-1 text-xs text-slate-300">BTC ${usd(rbw.price)} · modelo ${usd(rbw.model)} · <b class="${cls(rbw.vsModel)}">${pct(rbw.vsModel, 1)}</b> vs modelo</div>
      <div class="label mt-1">${rbw.ceiling ? `techo de la banda ${usd(rbw.ceiling)}` : 'sin techo (última banda)'}${rbw.floor ? ` · suelo ${usd(rbw.floor)}` : ''} · bandas ajustadas a la volatilidad de cada ciclo</div></div>` : noData('Rainbow Chart');

  const mM = v => `${fmt(v / 1e6, { maximumFractionDigits: 1 })} M$`;
  const hlCard = liq ? `<div class="card"><div class="flex flex-wrap items-baseline justify-between gap-2"><h2 class="font-semibold">Liquidaciones en Hyperliquid</h2><span class="label">${liq.asOf || ''}</span></div>
      <p class="label">Posiciones reales de BTC en Hyperliquid (Axel Adler Jr)${liq.price ? ` · precio ${usd(liq.price)}` : ''}.</p>
      <div class="mt-2 grid grid-cols-2 gap-3"><div><div class="label">Longs dentro de −5 %</div><div class="num text-xl neg">${mM(liq.longs5)}</div><div class="label">se liquidan por debajo</div></div>
        <div><div class="label">Shorts dentro de +5 %</div><div class="num text-xl pos">${mM(liq.shorts5)}</div><div class="label">se liquidan por encima</div></div></div>
      <div class="label mt-3">Los 4 mayores niveles</div>
      <table class="tbl"><thead><tr><th>Precio</th><th>Distancia</th><th>Lado</th><th class="text-right">Valor</th></tr></thead><tbody>${liq.levels.map(l => `<tr><td class="num">${fmt(l.lo)} – ${fmt(l.hi)} $</td><td class="num ${cls(l.dist)}">${l.dist > 0 ? '+' : ''}${fmt(l.dist)} %</td><td>${l.side === 'Longs' ? 'Longs' : 'Shorts'}</td><td class="num text-right">${mM(l.value)}</td></tr>`).join('')}</tbody></table></div>` : noData('Liquidaciones en Hyperliquid');
  const r5 = cgl && cgl.row5, cgOk = cgl && (cgl.shortsAbove || cgl.longsBelow || r5);
  const cgCard = cgOk ? `<div class="card"><div class="flex flex-wrap items-baseline justify-between gap-2"><h2 class="font-semibold">Heatmap de liquidaciones (CoinGecko)</h2><span class="label">${(cgl.updated || '').slice(0, 10)}</span></div>
      <p class="label">BTC en Binance, Bybit y Gate: estimación de CoinGecko. Son valores relativos de apalancamiento, no dólares.</p>
      <div class="mt-2 grid grid-cols-2 gap-3"><div><div class="label">Shorts arriba${r5 ? ' (+5 %)' : ''}</div><div class="num text-xl pos">${r5 ? r5.shorts : cgl.shortsAbove || '—'}</div><div class="label">${r5 ? `si sube a ${r5.risesTo}` : 'total sobre el precio'}</div></div>
        <div><div class="label">Longs abajo${r5 ? ' (−5 %)' : ''}</div><div class="num text-xl neg">${r5 ? r5.longs : cgl.longsBelow || '—'}</div><div class="label">${r5 ? `si cae a ${r5.fallsTo}` : 'total bajo el precio'}</div></div></div>
      ${cgl.top ? `<div class="mt-3 text-sm">Mayor acumulación: <b>${cgl.top.side}</b> entre ${cgl.top.from || 'el precio actual'} y ${cgl.top.to} <span class="label">(tramo hasta ±${esc(String(cgl.top.move || '').replace(/[±+-]/g, ''))})</span></div>` : ''}
      <div class="label mt-2">Totales: ${cgl.shortsAbove ? `shorts arriba ${esc(cgl.shortsAbove)}` : ''}${cgl.longsBelow ? ` · longs abajo ${esc(cgl.longsBelow)}` : ''}. <a class="text-[#38bdf8] underline" href="https://www.coingecko.com/en/charts/liquidation-heatmap" target="_blank" rel="noopener noreferrer">Abrir en CoinGecko</a></div></div>`
    : `<div class="card"><h2 class="font-semibold">Heatmap de liquidaciones (CoinGecko)</h2><p class="label">Resumen no disponible todavía: CoinGecko dibuja esta página con JavaScript y la lectura automática aún no ha devuelto datos. <a class="text-[#38bdf8] underline" href="https://www.coingecko.com/en/charts/liquidation-heatmap" target="_blank" rel="noopener noreferrer">Abrir en CoinGecko</a></p></div>`;

  const from = RANGES[range] === Infinity ? 0 : Date.now() - RANGES[range] * 864e5;
  const fp = arr => thin((arr || []).map(([dd2, v]) => [Date.parse(dd2), v]).filter(p => Number.isFinite(p[0]) && p[0] >= from));
  const fngChart = fng ? card('Fear &amp; Greed Index', 'Verde: índice de CoinGecko, que se va guardando día a día desde que se activó (su histórico completo es de pago). Gris: índice de alternative.me, otra metodología, con histórico desde 2018.',
    axisChart({ series: [{ label: 'CoinGecko', color: '#22c55e', pts: fp(fng.hist) }, { label: 'alternative.me', color: '#64748b', pts: fp(fng.alt) }], kind: 'idx', yMin: 0, yMax: 100, height: 200 })) : '';
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
    <div class="grid gap-4 lg:grid-cols-2">${fngCard}${rbwCard}</div>
    <div class="grid gap-4 lg:grid-cols-2">${cgCard}${hlCard}</div>
    ${card('Precio y precio realizado', 'El precio realizado es el coste medio de todas las monedas en su último movimiento.', has(d.realized)
      ? lineChart({ log: true, series: [{ label: 'Precio BTC', color: '#f7931a', pts: points(d, d.price) }, { label: 'Precio realizado', color: '#38bdf8', pts: points(d, d.realized) }] }) : unavailable)}
    ${card('MVRV', 'Precio de mercado ÷ precio realizado. Por debajo de 1, el mercado cotiza bajo el coste medio on-chain.', has(d.mvrv)
      ? lineChart({ series: [{ label: 'MVRV', color: '#22c55e', pts: points(d, d.mvrv) }], lines: [{ y: 1, label: '1,0' }], yfmt: v => fmt(v, { maximumFractionDigits: 2 }) }) : unavailable)}
    ${card('Media móvil de 200 semanas', 'Media de los últimos 1.400 días de precio: soporte histórico de largo plazo.', has(d.ma200)
      ? lineChart({ log: true, series: [{ label: 'Precio BTC', color: '#f7931a', pts: points(d, d.price) }, { label: 'Media 200 semanas', color: '#a78bfa', pts: points(d, d.ma200) }] }) : unavailable)}
    ${card('RSI diario de 14 días', 'Calculado en tu navegador con los precios de cierre diarios (método de Wilder).', has(d.rsi)
      ? lineChart({ domain: [0, 100], series: [{ label: 'RSI 14', color: '#fbbf24', pts: points(d, d.rsi) }], lines: [{ y: 70, label: '70' }, { y: 30, label: '30' }], height: 180, yfmt: v => fmt(v, { maximumFractionDigits: 0 }) }) : unavailable)}
    ${fngChart}
    ${card('Rainbow Chart de Bitcoin', 'Gráfico de Axel Adler Jr, incrustado desde su web. Nueve bandas de valoración respecto a la tendencia de largo plazo.', `
      <iframe src="https://axeladlerjr.com/charts/bitcoin-rainbow-chart/embed.html" width="100%" height="480" style="border:0" loading="lazy" title="Bitcoin Rainbow Chart"></iframe>
      <p class="label mt-2">Fuente: <a class="text-[#38bdf8] underline" href="https://axeladlerjr.com/charts/bitcoin-rainbow-chart/" target="_blank" rel="noopener noreferrer">Bitcoin Rainbow Chart</a> (axeladlerjr.com).</p>`)}
    ${card('Mapa de liquidaciones de Bitcoin (Hyperliquid)', 'Gráfico de Axel Adler Jr con posiciones reales de Hyperliquid, incrustado desde su web.', `
      <iframe src="https://axeladlerjr.com/charts/bitcoin-liquidation-map/embed.html" width="100%" height="640" style="border:0" loading="lazy" title="Bitcoin Liquidation Map"></iframe>
      <p class="label mt-2">Fuente: <a class="text-[#38bdf8] underline" href="https://axeladlerjr.com/charts/bitcoin-liquidation-map/" target="_blank" rel="noopener noreferrer">Bitcoin Liquidation Map</a> (axeladlerjr.com). Heatmap de CoinGecko: <a class="text-[#38bdf8] underline" href="https://www.coingecko.com/en/charts/liquidation-heatmap" target="_blank" rel="noopener noreferrer">abrir en CoinGecko</a>.</p>`)}
    ${card('Flujos netos de ETFs de Bitcoin', 'Gráfico de Axel Adler Jr, incrustado desde su web.', `
      <iframe src="${ETF_EMBED}" width="100%" height="640" style="border:0" loading="lazy" title="Bitcoin ETF Flows"></iframe>
      <p class="label mt-2">Fuente: <a class="text-[#38bdf8] underline" href="${ETF_URL}" target="_blank" rel="noopener noreferrer">Bitcoin ETF Flows</a> (axeladlerjr.com).</p>`)}
    <p class="label">Datos on-chain: Bitview (bitview.space), licencia CC BY 4.0. Gráficos ETF, Rainbow y liquidaciones: axeladlerjr.com. Fear & Greed y heatmap: CoinGecko; Fear & Greed histórico: alternative.me. MVRV, media de 200 semanas y RSI se calculan localmente.</p>`;

  root.querySelectorAll('[data-mrange]').forEach(el => (el.onclick = () => { range = el.dataset.mrange; render(); }));
}
