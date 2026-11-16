import { loadMarketData, loadBtcLedger, loadHistory, loadStakingApr } from './data.js';
import { manualFileText } from './manualtext.js';
import * as store from './store.js';
import { aggregateHoldings, fundPrice, computeDcaTable } from './accounting.js';
import { DUAL_ASSETS, CEX_ASSETS, WALLETS } from './config.js';
import { short, esc } from './format.js';
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
let aprLive = {}, aprTried = false;

/* ---------- Navegación por pestañas ---------- */
const tabs = [...document.querySelectorAll('.tab')];
function showTab(id) {
  if (!document.getElementById(`tab-${id}`)) id = 'inicio';
  tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
  document.querySelectorAll('.tab-panel').forEach(p => (p.hidden = p.id !== `tab-${id}`));
  history.replaceState(null, '', `#${id}`);
  if (id === 'metricas') metrics.ensure(); // las métricas se descargan al abrir la pestaña
  if (id === 'staking' && !aprTried) { aprTried = true; loadStakingApr().then(a => { aprLive = a; refresh(); }); } // APR de DefiLlama al abrir Staking
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
  const mErr = store.loadError();
  bootMsg(mErr ? `Error en data/manual.js: ${mErr}` : '');
  const state = store.getState();
  const view = aggregateHoldings({ onchain: market.onchain, state, prices: market.prices, eurUsd: market.eurUsd });
  const shares = store.totalShares();
  const fund = fundPrice(view.totalUsd, market.eurUsd, shares);
  const ctx = { view, state, market, ledger, history: historyData, aprLive };
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

  const notes = [];
  if (view.missing.length) notes.push(`Sin precio para: ${view.missing.join(', ')} (valoradas en 0).`);
  if (market.chainFailed?.length) notes.push(`No se pudo leer: ${market.chainFailed.join(', ')}.`);
  const ign = [...new Set(market.ignored || [])];
  const note = $('#missing-note');
  note.hidden = !notes.length && !ign.length;
  note.innerHTML = notes.map(esc).join(' ') + (ign.length ? `<details class="mt-1"><summary class="cursor-pointer">${ign.length} tokens no reconocidos ignorados (probablemente spam o sin precio)</summary>${esc(ign.join(', '))}</details>` : '');

  const s = market.sources;
  const badge = $('#data-badge');
  const NAMES = { prices: 'precios', btc: 'BTC', pools: 'Pools', evm: 'EVM', bsc: 'BSC', hyperliquid: 'Hyperliquid', tron: 'Tron', cosmos: 'Cosmos' };
  const bad = Object.entries(s).filter(([, v]) => v !== 'live').map(([k, v]) => `${NAMES[k] || k} ${v === 'partial' ? 'parcial' : v === 'file' ? 'desde archivo' : v === 'none' ? 'sin datos' : 'simulado'}`);
  badge.className = `badge ${bad.length ? 'mock' : 'live'}`;
  badge.textContent = bad.length ? `Datos no reales: ${bad.join(', ')}` : 'Datos reales';
}

/* ---------- Pestaña 6: datos manuales (solo lectura; se editan en data/manual.js) ---------- */
let copyMap = {};

// Datos de la versión anterior (formularios) que pudieran quedar guardados en ESTE navegador
function readLegacy() {
  try {
    const s = JSON.parse(localStorage.getItem('cripto-dashboard:v1') || 'null');
    if (!s) return null;
    const any = Object.values(s.cex || {}).some(v => v > 0) || s.dual?.length || s.dca?.length || s.shares?.movements?.length
      || Object.keys(s.poolEntries || {}).length || s.dualDebt > 0 || Object.keys(s.stakingManual || {}).length;
    return any ? s : null;
  } catch { return null; }
}

function renderManual(state, view, fund, shares) {
  const err = store.loadError();
  const positions = market.pools?.positions || [];
  const last = state.dca.at(-1);
  const legacy = readLegacy();
  const template = positions.map(p => `    '${p.id}': { date: '', invested: 0, a0: 0, a1: 0 },   // ${p.pair} (${p.protocol}, ${p.network})`).join('\n');
  copyMap = { pools: template, legacy: legacy ? manualFileText(legacy) : '' };
  const row = (k, v) => `<tr><td>${k}</td><td class="num r">${v}</td></tr>`;

  $('#manual-root').innerHTML = `
  <div class="card">
    <h2 class="font-semibold">Datos manuales</h2>
    <p class="label mb-2">Se leen del archivo <b>data/manual.js</b> de tu repositorio y se ven igual en todos tus dispositivos. Para cambiarlos: GitHub → <b>data/manual.js</b> → lápiz → editar → <b>Commit changes</b> → recarga la web (Ctrl+F5). Tras cada cambio de la web o del archivo puede tardar un par de minutos en publicarse.</p>
    ${err ? `<p class="neg text-sm">No se pudo leer data/manual.js: ${esc(err)}</p>` : '<p class="label">Archivo leído correctamente.</p>'}
  </div>

  <div class="grid gap-4 lg:grid-cols-2">
    <div class="card"><h2 class="mb-2 font-semibold">Fondos en exchanges</h2><table class="tbl"><tbody>
      ${CEX_ASSETS.map(a => row(a, qty(state.cex[a] || 0))).join('')}</tbody></table></div>
    <div class="card"><h2 class="mb-2 font-semibold">Dual Investment (BSC), staking manual y DCA</h2><table class="tbl"><tbody>
      ${DUAL_ASSETS.map(a => row('Dual ' + a, qty(state.dual.find(p => p.asset === a)?.amount || 0))).join('')}
      ${row('Deuda USDT (Dual)', usd(state.dualDebt))}
      ${row('SKY en staking', qty(state.stakingManual.SKY || 0))}
      ${row('PSOL en staking (Phantom)', qty(state.stakingManual.PSOL || 0))}
      ${row('DCA: filas / última', last ? `${state.dca.length} · ${last.month} · deuda ${usd(last.debt)}` : 'sin datos')}</tbody></table></div>
  </div>

  <div class="card"><h2 class="mb-2 font-semibold">Participaciones del fondo</h2>
    <p class="label">Base ${fmt(state.shares.base)} + ${state.shares.movements.length} movimientos = <b class="num">${fmt(shares, { maximumFractionDigits: 4 })}</b> participaciones · precio actual <b class="num">${usd(fund.usd)}</b> / <b class="num">${eur(fund.eur)}</b></p></div>

  <div class="card"><h2 class="mb-2 font-semibold">Entradas de pools</h2>
    <p class="label mb-3">Las posiciones son las que carga ahora la pestaña Pools (se actualizan solas; las cerradas desaparecen). Para calcular IL, tiempo y ROI, copia la línea de cada pool a la sección <b>poolEntries</b> de data/manual.js y rellena fecha (AAAA-MM-DD), importe invertido y, si quieres el IL, las cantidades iniciales a0 y a1 de los dos tokens.</p>
    ${positions.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Pool</th><th>id</th><th>Entrada en el archivo</th></tr></thead><tbody>
      ${positions.map(p => { const e = state.poolEntries[p.id]; return `<tr><td>${esc(p.pair)}<div class="label">${esc(p.protocol)} · ${esc(p.network)}</div></td><td class="num">${esc(p.id)}</td><td>${e ? `<span style="color:#22c55e">sí</span> · ${esc(e.date)} · ${usd(e.invested)}` : '<span class="label">falta</span>'}</td></tr>`; }).join('')}</tbody></table></div>
      <button class="btn mt-3" data-copy="pools" type="button">Copiar líneas de todas las posiciones</button> <span id="copy-msg-pools" class="label ml-2"></span>` : '<p class="label">No hay posiciones de pools cargadas.</p>'}
    ${Object.keys(state.poolEntries).some(id => !positions.some(p => p.id === id)) ? '<p class="label mt-3">Hay entradas en el archivo de pools que ya no existen (cerrados). Puedes borrar esas líneas.</p>' : ''}
  </div>

  ${legacy ? `<div class="card" style="border-color:#fbbf24"><h2 class="mb-2 font-semibold">Datos de la versión anterior guardados en este navegador</h2>
    <p class="label mb-3">Antes los datos se escribían en formularios de la web y se guardaban solo en este navegador. Para pasarlos al archivo: pulsa <b>Copiar</b>, abre <b>data/manual.js</b> en GitHub (si no existe: Add file → Create new file → data/manual.js), borra su contenido, pega y haz Commit.</p>
    <button class="btn" data-copy="legacy" type="button">Copiar el contenido para data/manual.js</button> <span id="copy-msg-legacy" class="label ml-2"></span>
    <textarea class="inp num mt-3" rows="10" readonly>${esc(copyMap.legacy)}</textarea></div>` : ''}`;
}

$('#manual-root').addEventListener('click', async e => {
  const k = e.target.dataset.copy;
  if (!k) return;
  const msg = $('#copy-msg-' + k);
  try { await navigator.clipboard.writeText(copyMap[k]); if (msg) msg.textContent = 'Copiado.'; }
  catch { if (msg) msg.textContent = 'No se pudo copiar automáticamente: selecciona el texto y cópialo a mano.'; }
});

/* ---------- Arranque ---------- */
let started = false;
function sync() {
  refresh();
  if (started) return;
  started = true;
  loadMarketData(WALLETS.btc).then(m => { market = m; refresh(); });
  loadBtcLedger(WALLETS.btc, list => { ledger = list; refresh(); });
}
showTab(location.hash.slice(1) || 'inicio');
loadHistory().then(h => { historyData = h; refresh(); });
store.load().then(sync);          // primero se leen los datos manuales (data/manual.js)
