import { usd, pct, fmt, cls, stackedBar, donut, treemap } from '../format.js';
import { WALLETS } from '../config.js';
import { axisChart } from '../charts.js';
import { fundPrice } from '../accounting.js';
import { stakingData } from './staking.js';

// Filtros del gráfico (se mantienen entre refrescos)
let range = '30d', net = '', asset = '', last = null;
const DAYS = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
const RANGES = ['7d', '30d', '90d', '365d', 'YTD'];

const keyMatch = (k, n, a) => { const [kn, ka] = k.split('|'); return (!n || kn === n) && (!a || ka === a); };

function series(history) {
  const from = range === 'YTD' ? Date.UTC(new Date().getUTCFullYear(), 0, 1) : Date.now() - DAYS[range] * 864e5;
  return history.filter(h => !h.partial && Date.parse(h.t) >= from).map(h => ({
    t: Date.parse(h.t),
    v: net || asset ? Object.entries(h.pos || {}).filter(([k]) => keyMatch(k, net, asset)).reduce((t, [, v]) => t + v, 0) : h.totalUsd,
  }));
}

function chart(pts) {
  if (pts.length < 2) return '<div class="label p-6">Aún no hay suficientes snapshots completos para dibujar la evolución. Se guardan solos con el workflow «Snapshot diario» cuando todas las fuentes sean reales.</div>';
  const W = 600, H = 220, P = 8, ys = pts.map(p => p.v);
  const x0 = pts[0].t, x1 = pts.at(-1).t, y0 = Math.min(...ys), y1 = Math.max(...ys);
  const X = t => P + (t - x0) / (x1 - x0 || 1) * (W - 2 * P), Y = v => H - P - (v - y0) / (y1 - y0 || 1) * (H - 2 * P);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
  const change = ys[0] ? (ys.at(-1) / ys[0] - 1) * 100 : 0;
  const day = t => new Date(t).toISOString().slice(0, 10);
  return `${axisChart({ series: [{ label: 'Patrimonio', color: change >= 0 ? '#22c55e' : '#ef4444', pts: pts.map(p => [p.t, p.v]) }], kind: 'usd', time: true })}
    <div class="num mt-1 flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>${day(x0)}</span><span>mín ${usd(y0)} · máx ${usd(y1)} · <b class="${change < 0 ? 'neg' : 'text-[#22c55e]'}">${pct(change, 2)}</b></span><span>${day(x1)}</span></div>`;
}

// Evolución comparativa: Precio Participación (EUR) vs Precio Bitcoin (EUR) en base 100
function fundVsBtcChart({ state, view, market, history = [], btcEurHist = {} }) {
  const eur = n => fmt(n, { style: 'currency', currency: 'EUR' });
    const fx = btcEurHist.fx || {};
  const fxAt = d => {   // USD por EUR de esa fecha (dato más cercano, hasta 10 días); si no hay, el de hoy
    if (fx[d]) return fx[d];
    const t = Date.parse(d); let best = null, bd = 10 * 864e5;
    for (const k in fx) { const dd = Math.abs(Date.parse(k) - t); if (dd < bd) { bd = dd; best = k; } }
    return best ? fx[best] : market.eurUsd;
  };
  const usdToEur = (p, d) => { const r = fxAt(d); return p > 0 && r > 0 ? p / r : null; };
  const nearestBtc = d => {
    if (btcEurHist[d]) return usdToEur(btcEurHist[d], d);
    const t = Date.parse(d), keys = Object.keys(btcEurHist);
    if (!keys.length) return null;
    const best = keys.reduce((a, b) => Math.abs(Date.parse(b) - t) < Math.abs(Date.parse(a) - t) ? b : a);
    return Math.abs(Date.parse(best) - t) <= 7 * 864e5 ? usdToEur(btcEurHist[best], d) : null;
  };
  const ptsMap = new Map();
  // 1. Puntos históricos manuales de movimientos de participaciones (precio BTC desde CoinGecko si está disponible)
  for (const m of state.shares?.movements || []) {
    if (m.date && m.price > 0) {
      ptsMap.set(m.date, { t: Date.parse(m.date), fund: m.price, btc: nearestBtc(m.date) });
    }
  }
  // 2. Snapshots completos (tienen fundEur y btcUsd, con respaldo de CoinGecko)
  for (const h of history) {
    if (h.partial || !(h.fundEur > 0)) continue;
    const d = h.t.slice(0, 10);
    const eurUsd = h.totalEur > 0 ? h.totalUsd / h.totalEur : market.eurUsd;
    const btcEur = h.btcUsd > 0 ? h.btcUsd / eurUsd : nearestBtc(d);
    ptsMap.set(d, { t: Date.parse(h.t), fund: h.fundEur, btc: btcEur });
  }
  // 3. Punto actual en vivo
  const shares = state.shares.base + (state.shares.movements || []).reduce((t, m) => t + (m.type === 'add' ? m.qty : -m.qty), 0);
  const curFund = fundPrice(view.totalUsd, market.eurUsd, shares).eur;
  const curBtc = market.prices?.BTC?.eur || 0;
  if (curFund > 0) ptsMap.set(new Date().toISOString().slice(0, 10), { t: Date.now(), fund: curFund, btc: curBtc || null });

  const pts = [...ptsMap.values()].sort((a, b) => a.t - b.t);
  if (pts.length < 2) return '<div class="label p-6">Se necesitan al menos 2 registros de participación para dibujar la comparativa.</div>';

  const f0 = pts[0].fund;
  const btcPts = pts.filter(p => p.btc > 0);
  const b0 = btcPts[0]?.btc || null;

  const normF = pts.map(p => ({ t: p.t, n: (p.fund / f0) * 100 }));
  const normB = b0 ? btcPts.map(p => ({ t: p.t, n: (p.btc / b0) * 100 })) : [];
  const allN = [...normF.map(p => p.n), ...normB.map(p => p.n)];

  const W = 600, H = 210, P = 10;
  const x0 = pts[0].t, x1 = pts.at(-1).t, y0 = Math.min(...allN), y1 = Math.max(...allN);
  const X = t => P + (t - x0) / (x1 - x0 || 1) * (W - 2 * P);
  const Y = v => H - P - (v - y0) / (y1 - y0 || 1) * (H - 2 * P);

  const dF = normF.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.n).toFixed(1)}`).join('');
  const dB = normB.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.n).toFixed(1)}`).join('');
  const chgF = (pts.at(-1).fund / f0 - 1) * 100;
  const chgB = b0 && btcPts.length > 1 ? (btcPts.at(-1).btc / b0 - 1) * 100 : null;
  const day = t => new Date(t).toISOString().slice(0, 10);
  return `${axisChart({
      series: [
        { label: 'Participación', color: '#22c55e', pts: pts.map(p => [p.t, (p.fund / f0) * 100, p.fund]) },
        ...(b0 && btcPts.length >= 2 ? [{ label: 'Bitcoin', color: '#f7931a', pts: btcPts.map(p => [p.t, (p.btc / b0) * 100, p.btc]) }] : []),
      ],
      kind: 'idx', rawKind: 'eur',
    })}
  <div class="num mt-1 flex flex-wrap justify-between gap-2 text-xs text-slate-400">
    <span>${day(x0)}</span>
    <span><i style="display:inline-block;width:.6rem;height:.2rem;background:#22c55e"></i> Partic. ${eur(pts.at(-1).fund)} (<b class="${cls(chgF)}">${pct(chgF, 1)}</b>)${chgB != null ? ` · <i style="display:inline-block;width:.6rem;height:.2rem;background:#f7931a"></i> BTC ${eur(btcPts.at(-1).btc)} (<b class="${cls(chgB)}">${pct(chgB, 1)}</b>)` : ''}</span>
    <span>${day(x1)}</span>
  </div>`;
}

function walletLabel(w) {
  if (WALLETS.btc.includes(w)) return 'Wallets Bitcoin';
  if (w.endsWith('890f')) return 'Metamask BNB';
  if (w.endsWith('86f2')) return 'Metamask Ledger';
  if (w.startsWith('TPR5')) return 'TronLink Ledger';
  if (w.startsWith('cosmos1')) return 'Cosmos Ledger';
  if (w === 'Phantom') return 'Phantom';
  return w;
}

function poolStatusHtml(x) {
  if (!x.range || !x.range.inRange || !x.valueUsd || x.tokens.length !== 2) return x.status;
  const p0 = pct(x.tokens[0].valueUsd / x.valueUsd * 100, 0);
  const p1 = pct(x.tokens[1].valueUsd / x.valueUsd * 100, 0);
  return `${x.status} <span class="label">(${p0} ${x.tokens[0].symbol} / ${p1} ${x.tokens[1].symbol})</span>`;
}

const opts = (list, cur, all) => `<option value="">${all}</option>` + list.map(v => `<option ${v === cur ? 'selected' : ''}>${v}</option>`).join('');

export function render(ctx) {
  last = ctx;
  const { view, market, history = [] } = ctx, b = view.by;
  const p = (o, k) => Math.max(0, o[k] || 0);

  const bars = [
    stackedBar('Autocustodia vs Exchanges', [
      { label: 'Autocustodia', value: p(b.custody, 'ledger') + p(b.custody, 'metamask') + p(b.custody, 'phantom'), color: '#38bdf8' },
      { label: 'Exchanges', value: p(b.custody, 'exchange'), color: '#a78bfa' }]),
    stackedBar('Ledger vs Metamask/Rabby vs Phantom', [
      { label: 'Ledger', value: p(b.custody, 'ledger'), color: '#22c55e' },
      { label: 'Metamask/Rabby', value: p(b.custody, 'metamask'), color: '#f7931a' },
      { label: 'Phantom', value: p(b.custody, 'phantom'), color: '#a78bfa' }]),
    stackedBar('Colateral vs Pools vs Staking vs Dual vs Libre', [
      { label: 'Colateral', value: p(b.category, 'colateral'), color: '#38bdf8' },
      { label: 'Pools', value: p(b.category, 'pools'), color: '#22c55e' },
      { label: 'Staking', value: p(b.category, 'staking'), color: '#a78bfa' },
      { label: 'Dual Investment', value: p(b.category, 'dual'), color: '#fbbf24' },
      { label: 'Libre', value: p(b.category, 'libre'), color: '#64748b' }]),
  ].join('');

  const pos = o => Object.entries(o).filter(([, v]) => v > 0).map(([label, value]) => ({ label, value }));
  const walletTotals = {};
  for (const [raw, val] of Object.entries(b.wallet)) {
    const lbl = walletLabel(raw);
    walletTotals[lbl] = (walletTotals[lbl] || 0) + val;
  }
  if (p(b.custody, 'exchange')) walletTotals['Exchanges'] = (walletTotals['Exchanges'] || 0) + p(b.custody, 'exchange');
  const wallets = pos(walletTotals);

  const full = history.filter(h => !h.partial);
  const keys = [...new Set(full.flatMap(h => Object.keys(h.pos || {})))];
  const nets = [...new Set(keys.map(k => k.split('|')[0]))].sort(), assets = [...new Set(keys.map(k => k.split('|')[1]))].sort();

  const pools = market.pools.positions, st = stakingData(ctx);
  const root = document.getElementById('home-root');
  root.innerHTML = `
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="card"><div class="mb-3 flex flex-wrap items-center gap-2">
        <h2 class="mr-auto font-semibold">Evolución del patrimonio</h2>
        ${RANGES.map(r => `<button class="btn ${r === range ? '' : 'btn-ghost'}" data-range="${r}" type="button">${r}</button>`).join('')}
        <select class="inp w-auto" id="f-net" aria-label="Red">${opts(nets, net, 'Todas las redes')}</select>
        <select class="inp w-auto" id="f-asset" aria-label="Activo">${opts(assets, asset, 'Todos los activos')}</select></div>
        ${chart(series(history))}</div>
      <div class="card"><h2 class="mb-3 font-semibold">Activos</h2>${treemap(view.holdings.map(h => ({ label: h.symbol, value: h.usd })), 280, market.eurUsd)}</div>
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="card space-y-4"><h2 class="font-semibold">Distribución</h2>${bars}</div>
      <div class="card"><h2 class="mb-1 font-semibold">Participación vs Bitcoin (EUR, base 100)</h2><p class="label mb-3">Evolución relativa desde el primer registro manual y snapshots diarios.</p>${fundVsBtcChart(ctx)}</div>
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="card"><h2 class="mb-3 font-semibold">Total por red</h2>${donut(pos(b.network))}</div>
      <div class="card"><h2 class="mb-3 font-semibold">Total por wallet</h2>${donut(wallets)}</div>
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="card scroll-x"><h2 class="mb-2 font-semibold">Pools de liquidez</h2><table class="tbl"><thead><tr><th>Par</th><th>Estado</th><th class="r">Valor</th></tr></thead><tbody>
        ${pools.map(x => `<tr><td>${x.pair}<div class="label">${x.protocol}</div></td><td style="color:${x.color}">${poolStatusHtml(x)}</td><td class="num r">${usd(x.valueUsd)}</td></tr>`).join('') || '<tr><td colspan="3" class="label">Sin posiciones</td></tr>'}</tbody></table></div>
      <div class="card scroll-x"><h2 class="mb-2 font-semibold">Staking</h2><table class="tbl"><thead><tr><th>Token</th><th class="r">Valor</th><th class="r">APR</th></tr></thead><tbody>
        ${st.rows.map(x => `<tr><td>${x.sym}</td><td class="num r">${usd(x.value)}</td><td class="num r">${pct(x.apr, 2)}</td></tr>`).join('')}
        <tr><td class="label">Total / media ponderada</td><td class="num r">${usd(st.tvl)}</td><td class="num r">${pct(st.wApr, 2)}</td></tr></tbody></table></div>
    </div>`;

  // Tooltip del treemap: nombre del activo, equivalente en € y porcentaje (también al tocar en el móvil)
  let tip = document.getElementById('tm-tip');
  if (!tip) {
    tip = document.createElement('div'); tip.id = 'tm-tip';
    tip.style.cssText = 'position:fixed;z-index:50;pointer-events:none;display:none;background:#0b0d16;border:1px solid #2d3142;border-radius:6px;padding:6px 10px;font-size:.8rem;line-height:1.3';
    document.body.appendChild(tip);
  }
  tip.style.display = 'none';
  const showTip = (el, x, y) => {
    tip.innerHTML = `<b>${el.dataset.name}</b><br><span class="num">${el.dataset.eur}</span> · <span class="num">${el.dataset.pct}</span>`;
    tip.style.display = 'block';
    tip.style.left = Math.max(4, Math.min(x + 14, innerWidth - tip.offsetWidth - 8)) + 'px';
    tip.style.top = Math.min(y + 14, innerHeight - tip.offsetHeight - 8) + 'px';
  };
  root.querySelectorAll('.tm-cell').forEach(el => {
    el.onmousemove = e => showTip(el, e.clientX, e.clientY);
    el.onmouseleave = () => (tip.style.display = 'none');
    el.onclick = e => showTip(el, e.clientX, e.clientY);
  });

  root.querySelectorAll('[data-range]').forEach(el => (el.onclick = () => { range = el.dataset.range; render(last); }));
  root.querySelector('#f-net').onchange = e => { net = e.target.value; render(last); };
  root.querySelector('#f-asset').onchange = e => { asset = e.target.value; render(last); };
}
