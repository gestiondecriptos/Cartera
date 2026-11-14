// Snapshot del patrimonio -> data/history.json. Lo ejecuta GitHub Actions (Node 20), sin navegador.
import fs from 'node:fs';
import { WALLETS, INITIAL_SHARES } from '../js/config.js';
import { loadMarketData } from '../js/data.js';
import { aggregateHoldings, fundPrice } from '../js/accounting.js';
import { poolItems } from '../js/tabs/pools.js';

const file = p => new URL(`../${p}`, import.meta.url);
const readJson = (p, fallback) => { try { return JSON.parse(fs.readFileSync(file(p), 'utf8')); } catch { return fallback; } };

const extra = readJson('data/wallets.json', {}).btc || [];
const manual = readJson('data/manual.json', {});
const state = {
  dual: manual.dual || [], cex: manual.cex || {}, dca: [],
  shares: manual.shares || { base: INITIAL_SHARES, movements: [] },
};
const shares = state.shares.base + (state.shares.movements || []).reduce((t, m) => t + (m.type === 'add' ? m.qty : -m.qty), 0);

const market = await loadMarketData([...new Set([...WALLETS.btc, ...extra])]);
const s = market.sources;
if (s.prices !== 'live' || s.btc !== 'live') {
  console.error('Precios o BTC on-chain no son reales (API caída o límite de peticiones). No se guarda nada.', s);
  process.exit(1);
}
const partial = Object.values(s).some(v => v !== 'live');
if (partial && process.env.INCLUDE_PARTIAL !== 'true') {
  console.log('Hay fuentes simuladas (', s, '): no se guarda el snapshot para no contaminar el histórico.');
  process.exit(0);
}

const view = aggregateHoldings({ onchain: [...market.onchain, ...poolItems()], state, prices: market.prices, eurUsd: market.eurUsd });
const fund = fundPrice(view.totalUsd, market.eurUsd, shares);
const pos = {};
for (const h of view.holdings) for (const x of h.sources) pos[`${x.network}|${h.symbol}`] = (pos[`${x.network}|${h.symbol}`] || 0) + x.usd;
for (const k in pos) pos[k] = Math.round(pos[k] * 100) / 100;

const entry = {
  t: new Date().toISOString(), totalUsd: Math.round(view.totalUsd * 100) / 100, totalEur: Math.round(view.totalEur * 100) / 100,
  fundUsd: Math.round(fund.usd * 100) / 100, fundEur: Math.round(fund.eur * 100) / 100,
  btcUsd: market.prices.BTC.usd, shares, pos, partial,
};
const history = readJson('data/history.json', []);
history.push(entry);
fs.writeFileSync(file('data/history.json'), JSON.stringify(history.slice(-4000), null, 1) + '\n');
console.log('Snapshot guardado:', entry.t, entry.totalUsd, 'USD', partial ? '(parcial)' : '');
