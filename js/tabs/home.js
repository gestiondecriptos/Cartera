import { usd, pct, stackedBar, donut, treemap, short } from '../format.js';
import { analysePools } from './pools.js';
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
  return `<svg viewBox="0 0 ${W} ${H}" class="w-full" role="img" aria-label="Evolución del patrimonio"><path d="${d}" fill="none" stroke="${change >= 0 ? '#22c55e' : '#ef4444'}" stroke-width="2"/></svg>
    <div class="num mt-1 flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>${day(x0)}</span><span>mín ${usd(y0)} · máx ${usd(y1)} · <b class="${change < 0 ? 'neg' : 'text-[#22c55e]'}">${pct(change, 2)}</b></span><span>${day(x1)}</span></div>`;
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
  const wallets = pos(b.wallet).map(w => ({ ...w, label: short(w.label) }));
  if (p(b.custody, 'exchange')) wallets.push({ label: 'Exchanges', value: p(b.custody, 'exchange') });

  const full = history.filter(h => !h.partial);
  const keys = [...new Set(full.flatMap(h => Object.keys(h.pos || {})))];
  const nets = [...new Set(keys.map(k => k.split('|')[0]))].sort(), assets = [...new Set(keys.map(k => k.split('|')[1]))].sort();

  const pools = analysePools(market.prices), st = stakingData(ctx);
  const root = document.getElementById('home-root');
  root.innerHTML = `
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="card"><div class="mb-3 flex flex-wrap items-center gap-2">
        <h2 class="mr-auto font-semibold">Evolución del patrimonio</h2>
        ${RANGES.map(r => `<button class="btn ${r === range ? '' : 'btn-ghost'}" data-range="${r}" type="button">${r}</button>`).join('')}
        <select class="inp w-auto" id="f-net" aria-label="Red">${opts(nets, net, 'Todas las redes')}</select>
        <select class="inp w-auto" id="f-asset" aria-label="Activo">${opts(assets, asset, 'Todos los activos')}</select></div>
        ${chart(series(history))}</div>
      <div class="card"><h2 class="mb-3 font-semibold">Activos</h2>${treemap(view.holdings.map(h => ({ label: h.symbol, value: h.usd })))}</div>
    </div>
    <div class="card space-y-4"><h2 class="font-semibold">Distribución</h2>${bars}</div>
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="card"><h2 class="mb-3 font-semibold">Total por red</h2>${donut(pos(b.network))}</div>
      <div class="card"><h2 class="mb-3 font-semibold">Total por wallet</h2>${donut(wallets)}</div>
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="card scroll-x"><h2 class="mb-2 font-semibold">Pools de liquidez</h2><table class="tbl"><thead><tr><th>Par</th><th>Estado</th><th class="r">ROI neto</th></tr></thead><tbody>
        ${pools.map(x => `<tr><td>${x.pair}<div class="label">${x.protocol}</div></td><td style="color:${x.color}">${x.status}</td><td class="num r">${pct(x.roiPct, 2)}</td></tr>`).join('')}</tbody></table></div>
      <div class="card scroll-x"><h2 class="mb-2 font-semibold">Staking</h2><table class="tbl"><thead><tr><th>Token</th><th class="r">Valor</th><th class="r">APR</th></tr></thead><tbody>
        ${st.rows.map(x => `<tr><td>${x.sym}</td><td class="num r">${usd(x.value)}</td><td class="num r">${pct(x.apr, 2)}</td></tr>`).join('')}
        <tr><td class="label">Total / media ponderada</td><td class="num r">${usd(st.tvl)}</td><td class="num r">${pct(st.wApr, 2)}</td></tr></tbody></table></div>
    </div>`;

  root.querySelectorAll('[data-range]').forEach(el => (el.onclick = () => { range = el.dataset.range; render(last); }));
  root.querySelector('#f-net').onchange = e => { net = e.target.value; render(last); };
  root.querySelector('#f-asset').onchange = e => { asset = e.target.value; render(last); };
}
