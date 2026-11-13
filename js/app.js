import { loadMarketData } from './data.js';
import * as store from './store.js';
import { aggregateHoldings, fundPrice, computeDcaTable } from './accounting.js';
import { DUAL_ASSETS, CEX_ASSETS } from './config.js';

const $ = s => document.querySelector(s);
const fmt = (n, o) => n.toLocaleString('es-ES', o);
const usd = n => fmt(n, { style: 'currency', currency: 'USD' });
const eur = n => fmt(n, { style: 'currency', currency: 'EUR' });
const qty = n => fmt(n, { maximumFractionDigits: 6 });
const cls = n => (n < 0 ? 'neg' : '');

let market = null;

/* ---------- Navegación por pestañas ---------- */
const tabs = [...document.querySelectorAll('.tab')];
function showTab(id) {
  if (!document.getElementById(`tab-${id}`)) id = 'inicio';
  tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
  document.querySelectorAll('.tab-panel').forEach(p => (p.hidden = p.id !== `tab-${id}`));
  history.replaceState(null, '', `#${id}`);
}
tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));

/* ---------- Render ---------- */
function refresh() {
  if (!market) return;
  const state = store.getState();
  const view = aggregateHoldings({ onchain: market.onchain, state, prices: market.prices, eurUsd: market.eurUsd });
  const shares = store.totalShares();
  const fund = fundPrice(view.totalUsd, market.eurUsd, shares);
  renderInicio(view, fund, shares);
  renderManual(state, view, fund, shares);
}

function renderInicio(view, fund, shares) {
  const btc = market.prices.BTC;
  $('#p-btc-usd').textContent = usd(btc.usd);
  $('#p-btc-eur').textContent = eur(btc.eur);
  $('#p-eurusd').textContent = fmt(market.eurUsd, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  $('#p-fund-usd').textContent = usd(fund.usd);
  $('#p-fund-eur').textContent = eur(fund.eur);
  $('#total-usd').textContent = usd(view.totalUsd);
  $('#total-eur').textContent = eur(view.totalEur);
  $('#shares').textContent = fmt(shares, { maximumFractionDigits: 4 });

  $('#holdings-body').innerHTML = view.holdings.map(h => `
    <tr>
      <td class="font-medium">${h.symbol}</td>
      <td class="num r ${cls(h.amount)}">${qty(h.amount)}</td>
      <td class="num r ${cls(h.usd)}">${usd(h.usd)}</td>
      <td class="label">${[...new Set(h.sources.map(s => s.raw))].join(', ')}</td>
    </tr>`).join('');

  const note = $('#missing-note');
  note.hidden = !view.missing.length;
  note.textContent = view.missing.length ? `Sin precio para: ${view.missing.join(', ')} (valoradas en 0).` : '';

  const s = market.sources;
  const badge = $('#data-badge');
  const allLive = s.prices === 'live' && s.btc === 'live' && s.otherChains === 'live';
  badge.className = `badge ${allLive ? 'live' : 'mock'}`;
  badge.textContent = `precios: ${s.prices === 'live' ? 'reales' : 'simulados'} · BTC on-chain: ${s.btc === 'live' ? 'real' : 'simulado'} · otras redes: simulado`;
}

/* ---------- Pestaña 6: datos manuales ---------- */
const field = (name, label, val = '', extra = 'type="number" step="any" min="0"') =>
  `<label class="block label">${label}<input class="inp num mt-1" name="${name}" ${extra} value="${val}"></label>`;

function renderManual(state, view, fund, shares) {
  const dca = computeDcaTable(state.dca, market.prices.BTC.usd);
  const mov = [...state.shares.movements].reverse();

  $('#manual-root').innerHTML = `
  <div class="card">
    <h2 class="font-semibold">Participaciones del fondo</h2>
    <p class="label mb-3">Base inicial: ${state.shares.base}. Precio por participación = valor total de la cartera ÷ participaciones.</p>
    <div class="mb-3 flex flex-wrap gap-6">
      <div><div class="label">Total participaciones</div><div class="num text-xl">${fmt(shares, { maximumFractionDigits: 4 })}</div></div>
      <div><div class="label">Precio actual</div><div class="num text-xl text-[#22c55e]">${usd(fund.usd)}</div></div>
    </div>
    <form data-form="shares" class="grid items-end gap-3 sm:grid-cols-4">
      ${field('qty', 'Cantidad', '', 'type="number" step="any" min="0" required')}
      ${field('price', 'Precio unitario (USD)', fund.usd.toFixed(2))}
      <button class="btn" name="type" value="add">Añadir</button>
      <button class="btn btn-ghost" name="type" value="sub">Restar</button>
    </form>
    <p id="share-msg" class="neg mt-2 text-sm"></p>
    ${mov.length ? `<div class="scroll-x mt-3"><table class="tbl"><thead><tr><th>Fecha</th><th>Tipo</th><th class="r">Cantidad</th><th class="r">Precio</th></tr></thead><tbody>
      ${mov.map(m => `<tr><td class="num">${m.date.slice(0, 10)}</td><td>${m.type === 'add' ? 'Ampliación' : 'Reducción'}</td><td class="num r">${fmt(m.qty)}</td><td class="num r">${usd(m.price)}</td></tr>`).join('')}
    </tbody></table></div>` : ''}
  </div>

  <div class="grid gap-4 lg:grid-cols-2">
    <form data-form="cex" class="card">
      <h2 class="font-semibold">Fondos en exchanges (CEX)</h2>
      <p class="label mb-3">Al guardar se sobrescribe lo anterior.</p>
      <div class="grid grid-cols-2 gap-3">${CEX_ASSETS.map(a => field(a, a, state.cex[a] || '')).join('')}</div>
      <button class="btn mt-3">Guardar CEX</button>
    </form>
    <form data-form="dual" class="card">
      <h2 class="font-semibold">Dual Investment (red BSC)</h2>
      <p class="label mb-3">Posiciones activas. Al guardar se sobrescribe lo anterior.</p>
      <div class="grid grid-cols-2 gap-3">${DUAL_ASSETS.map(a => field(a, a, state.dual.find(p => p.asset === a)?.amount ?? '')).join('')}</div>
      <button class="btn mt-3">Guardar Dual Investment</button>
    </form>
  </div>

  <div class="card">
    <h2 class="font-semibold">DCA con colateral (mensual)</h2>
    <p class="label mb-3">Si el mes ya existe, se reemplaza.</p>
    <form data-form="dca" class="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
      ${field('month', 'Mes', '', 'type="month" required')}
      ${field('buyUsd', 'Compra (USD)')}${field('debt', 'Deuda acumulada')}
      ${field('ltv', '% LTV')}${field('btc', 'BTC acumulado')}
      <button class="btn">Guardar mes</button>
    </form>
    ${dca.length ? `<div class="scroll-x mt-3"><table class="tbl"><thead><tr><th>Mes</th><th class="r">Compra</th><th class="r">Deuda</th><th class="r">% LTV</th><th class="r">BTC</th><th class="r">Valor sin deuda</th><th class="r">Precio compra est.</th><th></th></tr></thead><tbody>
      ${dca.map(r => `<tr><td class="num">${r.month}</td><td class="num r">${usd(r.buyUsd)}</td><td class="num r">${usd(r.debt)}</td><td class="num r">${fmt(r.ltv)}%</td><td class="num r">${qty(r.btc)}</td><td class="num r ${cls(r.valueNoDebt)}">${usd(r.valueNoDebt)}</td><td class="num r">${r.buyPriceEst == null ? '—' : usd(r.buyPriceEst)}</td><td><button class="btn btn-ghost" data-del-dca="${r.month}" type="button">Quitar</button></td></tr>`).join('')}
    </tbody></table></div>` : ''}
  </div>`;
}

$('#manual-root').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, d = Object.fromEntries(new FormData(f));
  try {
    if (f.dataset.form === 'cex') store.setCex(d);
    if (f.dataset.form === 'dual') store.setDualInvestment(DUAL_ASSETS.map(asset => ({ asset, amount: d[asset] })));
    if (f.dataset.form === 'dca') store.upsertDca(d);
    if (f.dataset.form === 'shares') store.addShareMovement({ type: e.submitter.value, qty: d.qty, price: d.price });
  } catch (err) {
    const msg = $('#share-msg'); if (msg) msg.textContent = err.message;
  }
});
$('#manual-root').addEventListener('click', e => {
  const m = e.target.dataset.delDca;
  if (m) store.removeDca(m);
});
$('#reset-btn').addEventListener('click', () => {
  if (confirm('¿Borrar todos los datos manuales? No se puede deshacer.')) store.resetAll();
});

/* ---------- Arranque ---------- */
store.subscribe(refresh);
showTab(location.hash.slice(1) || 'inicio');
loadMarketData().then(m => { market = m; refresh(); });
