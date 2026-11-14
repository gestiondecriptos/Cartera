import { loadMarketData, loadWalletsFile, loadBtcLedger, loadHistory } from './data.js';
import * as store from './store.js';
import { aggregateHoldings, fundPrice, computeDcaTable } from './accounting.js';
import { DUAL_ASSETS, CEX_ASSETS, WALLETS } from './config.js';
import { short } from './format.js';
import * as pools from './tabs/pools.js';
import * as staking from './tabs/staking.js';
import * as bitcoin from './tabs/bitcoin.js';
import * as home from './tabs/home.js';
import * as metrics from './tabs/metrics.js';

const $ = s => document.querySelector(s);
const fmt = (n, o) => n.toLocaleString('es-ES', o);
const usd = n => fmt(n, { style: 'currency', currency: 'USD' });
const eur = n => fmt(n, { style: 'currency', currency: 'EUR' });
const qty = n => fmt(n, { maximumFractionDigits: 6 });
const cls = n => (n < 0 ? 'neg' : '');

let market = null;
let ledger = [];
let historyData = [];
let fileAddrs = [];
const allAddrs = () => [...new Set([...WALLETS.btc, ...fileAddrs, ...store.getState().btcAddresses])];

/* ---------- Navegación por pestañas ---------- */
const tabs = [...document.querySelectorAll('.tab')];
function showTab(id) {
  if (!document.getElementById(`tab-${id}`)) id = 'inicio';
  tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
  document.querySelectorAll('.tab-panel').forEach(p => (p.hidden = p.id !== `tab-${id}`));
  history.replaceState(null, '', `#${id}`);
  if (id === 'metricas') metrics.ensure(); // las métricas se descargan al abrir la pestaña
}
tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));

/* ---------- Render ---------- */
function bootMsg(t) {
  const b = $('#boot-msg');
  if (b) { b.textContent = t; b.style.color = t.startsWith('Error') ? '#f87171' : ''; b.hidden = !t; }
}

function refresh() {
  if (!market) return;
  bootMsg('');
  const state = store.getState();
  const view = aggregateHoldings({ onchain: [...market.onchain, ...pools.poolItems()], state, prices: market.prices, eurUsd: market.eurUsd });
  const shares = store.totalShares();
  const fund = fundPrice(view.totalUsd, market.eurUsd, shares);
  const ctx = { view, state, market, ledger, history: historyData };
  // Si una pestaña falla, las demás siguen funcionando y se avisa en pantalla
  [['Inicio', () => renderInicio(view, fund, shares)],
   ['Inicio (gráficos)', () => home.render(ctx)],
   ['Datos manuales', () => renderManual(state, view, fund, shares)],
   ['Pools', () => pools.render(ctx)],
   ['Staking', () => staking.render(ctx)],
   ['Bitcoin', () => bitcoin.render(ctx)]].forEach(([name, fn]) => {
    try { fn(); } catch (e) { console.error(name, e); bootMsg(`Error en la pestaña «${name}»: ${e.message}`); }
  });
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
  const addrs = allAddrs();

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
      <p class="msg neg text-sm sm:col-span-4"></p>
    </form>
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
    <p class="label mb-3">Cada guardado añade una fila nueva: puedes registrar varias compras en el mismo mes.</p>
    <form data-form="dca" class="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
      ${field('month', 'Mes', '', 'type="month" required')}
      ${field('buyUsd', 'Compra (USD)')}${field('debt', 'Deuda acumulada')}
      ${field('ltv', '% LTV')}${field('btc', 'BTC acumulado')}
      <button class="btn">Añadir compra</button>
      <p class="msg neg text-sm sm:col-span-3 lg:col-span-6"></p>
    </form>
    ${dca.length ? `<div class="scroll-x mt-3"><table class="tbl"><thead><tr><th>Mes</th><th class="r">Compra</th><th class="r">Deuda</th><th class="r">% LTV</th><th class="r">BTC</th><th class="r">Valor sin deuda</th><th class="r">Precio compra est.</th><th></th></tr></thead><tbody>
      ${dca.map(r => `<tr><td class="num">${r.month}</td><td class="num r">${usd(r.buyUsd)}</td><td class="num r">${usd(r.debt)}</td><td class="num r">${fmt(r.ltv)}%</td><td class="num r">${qty(r.btc)}</td><td class="num r ${cls(r.valueNoDebt)}">${usd(r.valueNoDebt)}</td><td class="num r">${r.buyPriceEst == null ? '—' : usd(r.buyPriceEst)}</td><td><button class="btn btn-ghost" data-del-dca="${r.id}" type="button">Quitar</button></td></tr>`).join('')}
    </tbody></table></div>` : ''}
  </div>

  <div class="card">
    <h2 class="font-semibold">Direcciones BTC monitorizadas</h2>
    <p class="label mb-3">Introduce solo la dirección: las compras (fecha, cantidad y precio a fecha) se leen solas de mempool.space y aparecen en la pestaña Bitcoin.</p>
    <form data-form="btcaddr" class="flex flex-wrap items-end gap-3">
      <label class="label min-w-[16rem] flex-1">Nueva dirección BTC<input class="inp num mt-1" name="address" type="text" autocomplete="off" required></label>
      <button class="btn">Añadir</button>
      <p class="msg neg w-full text-sm"></p>
    </form>
    <div class="scroll-x mt-3"><table class="tbl"><thead><tr><th>Dirección</th><th>Origen</th><th></th></tr></thead><tbody>
      ${addrs.map(a => { const perm = WALLETS.btc.includes(a) ? 'config.js (permanente)' : fileAddrs.includes(a) ? 'wallets.json (permanente)' : null; return `<tr><td class="num" title="${a}">${short(a)}</td><td class="label">${perm || 'solo este navegador'}</td><td>${perm ? '' : `<button class="btn btn-ghost" data-del-addr="${a}" type="button">Quitar</button>`}</td></tr>`; }).join('')}
    </tbody></table></div>
    ${market.btcFailed?.length ? `<p class="neg mt-2 text-sm">No se pudo leer: ${market.btcFailed.map(short).join(', ')}</p>` : ''}
    <p class="label mt-3">Para que una dirección sea permanente (visible desde cualquier dispositivo): en tu repositorio de GitHub entra en <b>Actions → Añadir dirección BTC → Run workflow</b> y pega la dirección.</p>
  </div>`;
}

$('#manual-root').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, d = Object.fromEntries(new FormData(f));
  try {
    if (f.dataset.form === 'cex') store.setCex(d);
    if (f.dataset.form === 'dual') store.setDualInvestment(DUAL_ASSETS.map(asset => ({ asset, amount: d[asset] })));
    if (f.dataset.form === 'dca') store.addDca(d);
    if (f.dataset.form === 'btcaddr') store.addBtcAddress(d.address, [...WALLETS.btc, ...fileAddrs]);
    if (f.dataset.form === 'shares') store.addShareMovement({ type: e.submitter.value, qty: d.qty, price: d.price });
  } catch (err) {
    const msg = f.querySelector('.msg'); if (msg) msg.textContent = err.message;
  }
});
$('#manual-root').addEventListener('click', e => {
  const { delDca, delAddr } = e.target.dataset;
  if (delDca) store.removeDca(delDca);
  if (delAddr) store.removeBtcAddress(delAddr);
});
$('#export-btn').addEventListener('click', async () => {
  const { dual, cex, shares } = store.getState();
  const json = JSON.stringify({ dual, cex, shares }, null, 2);
  try { await navigator.clipboard.writeText(json); $('#export-msg').textContent = 'Copiado. Pégalo en data/manual.json de tu repositorio.'; }
  catch { prompt('Copia este texto y pégalo en data/manual.json:', json); }
});
$('#reset-btn').addEventListener('click', () => {
  if (confirm('¿Borrar todos los datos manuales? No se puede deshacer.')) store.resetAll();
});

/* ---------- Arranque ---------- */
// Si cambian las direcciones BTC, se vuelven a pedir saldos y compras
let btcKey = null;
function sync() {
  const addrs = allAddrs(), key = addrs.join('|');
  refresh();
  if (key === btcKey) return;
  btcKey = key;
  loadMarketData(addrs).then(m => { market = m; refresh(); });
  loadBtcLedger(addrs, list => { ledger = list; refresh(); });
}
store.subscribe(sync);
showTab(location.hash.slice(1) || 'inicio');
loadWalletsFile().then(a => { fileAddrs = a; sync(); });
loadHistory().then(h => { historyData = h; refresh(); });
