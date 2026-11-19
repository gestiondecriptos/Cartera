import { loadMarketData, loadBtcLedger, loadHistory, loadStakingApr, loadBtcEurHistory, btcFixedPricesText, fixedBtcHistory } from './data.js';
import { manualFileText } from './manualtext.js';
import { discoverEvmTokens } from './chains.js';
import * as store from './store.js';
import { aggregateHoldings, fundPrice, computeDcaTable } from './accounting.js';
import { DUAL_ASSETS, CEX_ASSETS, WALLETS } from './config.js';
import { short, esc } from './format.js';
import * as pools from './tabs/pools.js';
import * as staking from './tabs/staking.js';
import * as bitcoin from './tabs/bitcoin.js';
import * as home from './tabs/home.js';
import * as metrics from './tabs/metrics.js';
import { initChartTips, axisChart } from './charts.js';

const $ = s => document.querySelector(s);
const fmt = (n, o) => n.toLocaleString('es-ES', o);
const usd = n => fmt(n, { style: 'currency', currency: 'USD' });
const eur = n => fmt(n, { style: 'currency', currency: 'EUR' });
const qty = n => fmt(n, { maximumFractionDigits: 6 });
const cls = n => (n < 0 ? 'neg' : '');

let market = null;
let ledger = [];
let historyData = [];
let btcEurHist = {};
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

let rt = 0;
const refresh = () => { clearTimeout(rt); rt = setTimeout(doRefresh, 60); };
let manualReady = false;
function doRefresh() {
  if (!market || !manualReady) return;
  const mErr = store.loadError();
  bootMsg(mErr ? `Error en data/manual.js: ${mErr}` : '');
  const state = store.getState();
  const view = aggregateHoldings({ onchain: market.onchain, state, prices: market.prices, eurUsd: market.eurUsd });
  const shares = store.totalShares();
  const fund = fundPrice(view.totalUsd, market.eurUsd, shares);
  const ctx = { view, state, market, ledger, history: historyData, btcEurHist, aprLive };
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
   const loadingN = Object.entries(s).filter(([, v]) => v === 'loading').map(([k]) => NAMES[k] || k);
  const bad = Object.entries(s).filter(([, v]) => v !== 'live' && v !== 'loading').map(([k, v]) => `${NAMES[k] || k} ${v === 'partial' ? 'parcial' : v === 'file' ? 'desde archivo' : v === 'none' ? 'sin datos' : 'simulado'}`);
    badge.className = `badge ${bad.length || loadingN.length ? 'mock' : 'live'}`;
  badge.textContent = (loadingN.length ? `Cargando: ${loadingN.join(', ')}…` : '') + (loadingN.length && bad.length ? ' · ' : '') + (bad.length ? `Datos no reales: ${bad.join(', ')}` : '') || 'Datos reales';
}

/* ---------- Pestaña 6: datos manuales (solo lectura; se editan en data/manual.js) ---------- */
let copyMap = {};

function capitalCharts(movements) {
  const movs = [...movements].filter(m => m.date).sort((a, b) => a.date.localeCompare(b.date));
  if (!movs.length) return '<p class="label">Sin movimientos registrados.</p>';
  const flow = m => (m.type === 'sub' ? -1 : 1) * m.qty * m.price;

  // 1. Resumen anual: flujo neto por año (EUR), barras desde 0: entradas a la derecha, salidas a la izquierda
  const byYear = {};
  for (const m of movs) byYear[m.date.slice(0, 4)] = (byYear[m.date.slice(0, 4)] || 0) + flow(m);
  const years = Object.keys(byYear).sort();
  const maxAbs = Math.max(...years.map(y => Math.abs(byYear[y])), 1);
  const annualHtml = `<div class="mb-1 flex justify-between text-[11px] text-slate-500"><span>← Salidas netas</span><span>Entradas netas →</span></div>`
    + years.map(y => {
      const v = byYear[y], w = Math.abs(v) / maxAbs * 50, txt = `${v >= 0 ? '+' : ''}${eur(v)}`;
      return `<div class="mb-1.5 flex items-center gap-2 text-xs" data-tip="${esc(`<b>${y}</b><br><span class="num">${txt}</span>`)}">
        <span class="num w-9 shrink-0">${y}</span>
        <div class="relative h-5 flex-1"><div class="absolute inset-y-0 w-px bg-[#2d3142]" style="left:50%"></div>
          <div class="absolute rounded-sm" style="top:2px;bottom:2px;${v >= 0 ? 'left:50%' : 'right:50%'};width:${w}%;background:${v >= 0 ? '#22c55e' : '#ef4444'}"></div></div>
        <span class="num w-24 shrink-0 text-right ${cls(v)}">${txt}</span></div>`;
    }).join('');

  // 2. Flujo neto acumulado (EUR) con eje Y y valor al pasar el cursor
  let acc = 0;
  const pts = movs.map(m => { acc += flow(m); return [Date.parse(m.date), acc]; });
  const cumHtml = `${axisChart({ series: [{ label: 'Neto aportado', color: '#38bdf8', pts }], kind: 'eur', zero: true })}
    <div class="num mt-1 text-xs text-slate-400">Acumulado neto: <b class="text-[#e2e8f0]">${eur(acc)}</b></div>`;

  return `<div class="space-y-4">
    <div><h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Resumen anual (EUR)</h3>${annualHtml}</div>
    <div><h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Flujo neto acumulado (EUR)</h3>${cumHtml}</div>
  </div>`;
}

function renderManual(state, view, fund, shares) {
  const err = store.loadError();
  const positions = market.pools?.positions || [];
  const last = state.dca.at(-1);
  const template = positions.map(p => `    '${p.id}': { date: '', invested: 0, a0: 0, a1: 0 },   // ${p.pair} (${p.protocol}, ${p.network})`).join('\n');
  copyMap = { pools: template };
  const row = (k, v) => `<tr><td>${k}</td><td class="num r">${v}</td></tr>`;

  $('#manual-root').innerHTML = `
  ${err ? `<div class="card" style="border-color:#ef4444"><p class="neg text-sm">No se pudo leer data/manual.js: ${esc(err)}</p></div>` : ''}

  <div class="grid gap-4 lg:grid-cols-2">
    <div class="card"><h2 class="mb-2 font-semibold">Fondos en exchanges</h2><table class="tbl"><tbody>
      ${CEX_ASSETS.map(a => row(a, qty(state.cex[a] || 0))).join('')}</tbody></table></div>

    <div class="space-y-4">
      <div class="card"><h2 class="mb-2 font-semibold">Dual Investment (BSC)</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div><div class="label mb-1 font-medium text-slate-300">Metamask Ledger</div><table class="tbl"><tbody>
            ${DUAL_ASSETS.map(a => row(a, qty(state.dualLedger.find(p => p.asset === a)?.amount || 0))).join('')}
            ${row('Deuda USDT', usd(state.dualDebtLedger))}</tbody></table></div>
          <div><div class="label mb-1 font-medium text-slate-300">Metamask BNB</div><table class="tbl"><tbody>
            ${DUAL_ASSETS.map(a => row(a, qty(state.dualBnb.find(p => p.asset === a)?.amount || 0))).join('')}
            ${row('Deuda USDT', usd(state.dualDebtBnb))}</tbody></table></div>
        </div>
      </div>
      <div class="card"><h2 class="mb-2 font-semibold">Activos en órdenes abiertas</h2>
        ${state.openOrders.length ? `<table class="tbl"><tbody>${state.openOrders.map(x => row(`${esc(x.symbol)} <span class="label">${esc(x.where || x.network)} · ${esc(x.custody)}</span>`, qty(x.amount))).join('')}</tbody></table>` : '<p class="label">Sin activos en órdenes abiertas. Añádelos en <code>openOrders</code> de data/manual.js.</p>'}
        <p class="label mt-2">Suman al patrimonio. Solo los que no aparecen ya como saldo en una wallet o exchange.</p></div>
      <div class="card"><h2 class="mb-2 font-semibold">SKY staking + PSOL staking</h2><table class="tbl"><tbody>
        ${row('SKY en staking (Metamask Ledger)', qty(state.stakingManual.SKY || 0))}
        ${row('PSOL en staking (Phantom)', qty(state.stakingManual.PSOL || 0))}</tbody></table></div>
      ${state.manualAssets.length ? `<div class="card"><h2 class="mb-2 font-semibold">Otros activos manuales</h2><table class="tbl"><tbody>
        ${state.manualAssets.map(x => row(`${esc(x.symbol)} <span class="label">${esc(x.network)} · ${esc(x.custody)}</span>`, qty(x.amount))).join('')}</tbody></table></div>` : ''}
      <div class="card"><h2 class="mb-2 font-semibold">DCA</h2><table class="tbl"><tbody>
        ${row('Meses registrados', state.dca.length)}
        ${row('Último mes', last ? last.month : '—')}
        ${row('BTC acumulado (última fila)', last ? qty(last.btc) : '—')}
        ${row('Deuda registrada (última fila)', last ? usd(last.debt) : '—')}</tbody></table></div>
    </div>
  </div>

  <div class="card">
    <h2 class="mb-1 font-semibold">Ampliaciones y reducciones de capital</h2>
    <p class="label mb-4">Base ${fmt(state.shares.base)} + ${state.shares.movements.length} movimientos = <b class="num">${fmt(shares, { maximumFractionDigits: 4 })}</b> participaciones · valor actual <b class="num">${usd(fund.usd)}</b> / <b class="num">${eur(fund.eur)}</b></p>
    <div class="grid gap-6 lg:grid-cols-2">
      <div class="scroll-x">
        ${state.shares.movements.length ? `<table class="tbl"><thead><tr><th>Fecha</th><th>Tipo</th><th class="r">Partic.</th><th class="r">Precio (EUR)</th><th class="r">Total (EUR)</th></tr></thead><tbody>
          ${state.shares.movements.map(m => {
            const tot = (m.type === 'sub' ? -1 : 1) * m.qty * m.price;
            return `<tr><td class="num">${esc(m.date)}</td><td>${m.type === 'sub' ? '<span class="neg">Reducción</span>' : '<span style="color:#22c55e">Ampliación</span>'}</td><td class="num r">${qty(m.qty)}</td><td class="num r">${eur(m.price)}</td><td class="num r ${cls(tot)}">${eur(tot)}</td></tr>`;
          }).join('')}</tbody></table>` : '<p class="label">No hay ampliaciones ni reducciones registradas en data/manual.js.</p>'}
      </div>
      <div>${capitalCharts(state.shares.movements)}</div>
    </div>
  </div>

  <div class="card"><h2 class="mb-2 font-semibold">Entradas de pools</h2>
    <p class="label mb-3">Para calcular IL, tiempo y ROI, copia la línea de cada pool a <b>poolEntries</b> en <code>data/manual.js</code>.</p>
    ${positions.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Pool</th><th>id</th><th>Entrada en el archivo</th></tr></thead><tbody>
      ${positions.map(p => { const e = state.poolEntries[p.id]; return `<tr><td>${esc(p.pair)}<div class="label">${esc(p.protocol)} · ${esc(p.network)}</div></td><td class="num">${esc(p.id)}</td><td>${e ? `<span style="color:#22c55e">sí</span> · ${esc(e.date)} · ${usd(e.invested)}` : '<span class="label">falta</span>'}</td></tr>`; }).join('')}</tbody></table></div>
      <button class="btn mt-3" data-copy="pools" type="button">Copiar líneas de todas las posiciones</button> <span id="copy-msg-pools" class="label ml-2"></span>` : '<p class="label">No hay posiciones de pools cargadas.</p>'}
    ${Object.keys(state.poolEntries).some(id => !positions.some(p => p.id === id)) ? '<p class="label mt-3">Hay entradas en el archivo de pools que ya no existen (cerrados). Puedes borrar esas líneas.</p>' : ''}
  </div>`;
}

$('#manual-root').addEventListener('click', async e => {
  const k = e.target.dataset.copy;
  if (!k) return;
  const msg = $('#copy-msg-' + k);
  try { await navigator.clipboard.writeText(copyMap[k]); if (msg) msg.textContent = 'Copiado.'; }
  catch { if (msg) msg.textContent = 'No se pudo copiar automáticamente: selecciona el texto y cópialo a mano.'; }
});

/* ---------- Arranque ---------- */
initChartTips();
showTab(location.hash.slice(1) || 'inicio');
loadHistory().then(h => { historyData = h; refresh(); });
btcEurHist = fixedBtcHistory();   // tabla fija al instante; el último año llega después
loadBtcEurHistory().then(m => { btcEurHist = m; refresh(); });
const manualP = store.load();
loadMarketData(WALLETS.btc, m => { market = m; refresh(); }, manualP).then(m => { market = m; refresh(); });
loadBtcLedger(WALLETS.btc, list => { ledger = list; refresh(); });
manualP.then(() => { manualReady = true; refresh(); });

$('#disc-btn').addEventListener('click', async () => {
  const btn = $('#disc-btn'), msg = $('#disc-msg'), out = $('#disc-out');
  btn.disabled = true; msg.textContent = 'Leyendo…';
  try {
    const { text, failed } = await discoverEvmTokens();
    out.value = text; out.hidden = false;
    msg.textContent = failed.length ? `Con fallos: ${failed.join('; ')}` : 'Listo: copia el texto.';
  } catch (e) { msg.textContent = `Error: ${e.message}`; }
  btn.disabled = false;
});

$('#fix-btn').addEventListener('click', async () => {
  const btn = $('#fix-btn'), msg = $('#fix-msg'), out = $('#fix-out');
  btn.disabled = true; msg.textContent = 'Descargando…';
  try {
    out.value = await btcFixedPricesText(store.getState().shares.movements.map(m => m.date));
    out.hidden = false; msg.textContent = 'Listo: copia todo el texto y sustituye el contenido de js/btcfixed.js.';
  } catch (e) { msg.textContent = `Error: ${e.message}`; }
  btn.disabled = false;
});
