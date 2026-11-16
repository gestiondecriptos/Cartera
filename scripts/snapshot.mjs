// Snapshot del patrimonio -> data/history.json. Lo ejecuta GitHub Actions (Node 20), sin navegador.
import fs from 'node:fs';
import { WALLETS } from '../js/config.js';
import * as store from '../js/store.js';
import { loadMarketData } from '../js/data.js';
import { aggregateHoldings, fundPrice } from '../js/accounting.js';

const file = p => new URL(`../${p}`, import.meta.url);
const readJson = (p, fallback) => { try { return JSON.parse(fs.readFileSync(file(p), 'utf8')); } catch { return fallback; } };

// Datos manuales: data/manual.js (el mismo archivo que lee la web). Si tiene un error, el snapshot se detiene para no guardar datos incorrectos.
const manualRes = await store.load();
if (manualRes.error) { console.error('Error en data/manual.js:', manualRes.error); process.exit(1); }
const state = store.getState();
const shares = store.totalShares();

const market = await loadMarketData(WALLETS.btc);
// Los pools leídos se guardan para que la web los muestre si el navegador no puede consultar TrackDeFi
if (market.pools.source === 'live') fs.writeFileSync(file('data/pools.json'), JSON.stringify({ fetchedAt: market.pools.fetchedAt, results: market.pools.raws }) + '\n');
const s = market.sources;
if (s.prices !== 'live' || s.btc !== 'live') {
  console.error('Precios o BTC on-chain no son reales (API caída o límite de peticiones). No se guarda nada.', s);
  process.exit(1);
}
const partial = Object.values(s).some(v => v !== 'live');
if (partial && process.env.INCLUDE_PARTIAL !== 'true') {
  console.log('Hay fuentes simuladas o con lecturas fallidas (', s, '): no se guarda el snapshot para no contaminar el histórico.');
  process.exit(0);
}

const view = aggregateHoldings({ onchain: market.onchain, state, prices: market.prices, eurUsd: market.eurUsd });
const fund = fundPrice(view.totalUsd, market.eurUsd, shares);
const pos = {}, qty = {}; // pos = valor en USD, qty = cantidad de cada activo, por «red|activo»
for (const h of view.holdings) for (const x of h.sources) {
  const k = `${x.network}|${h.symbol}`;
  pos[k] = (pos[k] || 0) + x.usd;
  qty[k] = (qty[k] || 0) + x.amount;
}
for (const k in pos) { pos[k] = Math.round(pos[k] * 100) / 100; qty[k] = Math.round(qty[k] * 1e8) / 1e8; }

const entry = {
  t: new Date().toISOString(), totalUsd: Math.round(view.totalUsd * 100) / 100, totalEur: Math.round(view.totalEur * 100) / 100,
  fundUsd: Math.round(fund.usd * 100) / 100, fundEur: Math.round(fund.eur * 100) / 100,
  btcUsd: market.prices.BTC.usd, shares, pos, qty, partial,
};
const history = readJson('data/history.json', []);
history.push(entry);
fs.writeFileSync(file('data/history.json'), JSON.stringify(history.slice(-4000), null, 1) + '\n');
console.log('Snapshot guardado:', entry.t, entry.totalUsd, 'USD', partial ? '(parcial)' : '');
