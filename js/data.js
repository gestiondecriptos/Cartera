// Capa de datos: intenta la API real y, si falla (CORS, límite de peticiones, sin red), usa datos simulados.
import { WALLETS, COINGECKO_IDS } from './config.js';
import { MOCK_PRICES, MOCK_EUR_USD, MOCK_BTC_ONCHAIN, MOCK_OTHER_ONCHAIN } from './mock-data.js';

const API = 'https://mempool.space/api';
const get = async url => {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
};

async function fetchPrices() {
  try {
    const ids = [...new Set(Object.values(COINGECKO_IDS))].join(',');
    const json = await get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,eur`);
    const prices = {};
    for (const [sym, id] of Object.entries(COINGECKO_IDS)) if (json[id]?.usd) prices[sym] = json[id];
    if (!prices.BTC) throw new Error('CoinGecko sin BTC');
    return { prices, eurUsd: prices.BTC.usd / prices.BTC.eur, source: 'live' };
  } catch (e) {
    console.warn('Precios: usando datos simulados.', e.message);
    return { prices: MOCK_PRICES, eurUsd: MOCK_EUR_USD, source: 'mock' };
  }
}

/** Direcciones BTC guardadas de forma permanente en data/wallets.json (las añade el workflow de GitHub Actions). */
export async function loadWalletsFile() {
  try { const j = await get('data/wallets.json'); return Array.isArray(j.btc) ? j.btc : []; }
  catch { return []; }
}

/** Saldos on-chain. Una dirección que falla no tumba a las demás; si fallan todas, se usan datos simulados. */
async function fetchBtcOnchain(addresses) {
  const out = [], failed = [];
  for (const address of addresses) {
    try {
      const j = await get(`${API}/address/${address}`);
      const c = j.chain_stats, m = j.mempool_stats;
      const sats = c.funded_txo_sum - c.spent_txo_sum + m.funded_txo_sum - m.spent_txo_sum;
      out.push({ symbol: 'BTC', amount: sats / 1e8, network: 'Bitcoin', wallet: address, custody: 'ledger' });
    } catch (e) { console.warn('BTC on-chain: no se pudo leer', address, e.message); failed.push(address); }
  }
  if (!out.length) return { balances: MOCK_BTC_ONCHAIN, source: 'mock', failed: [] };
  return { balances: out, source: 'live', failed };
}

// Fase 1-2: BTC (mempool.space) es real; EVM/Solana/Tron/Cosmos siguen simulados hasta las fases siguientes.
export async function loadMarketData(btcAddresses = WALLETS.btc) {
  const [p, btc] = await Promise.all([fetchPrices(), fetchBtcOnchain(btcAddresses)]);
  return {
    prices: p.prices,
    eurUsd: p.eurUsd,
    onchain: [...btc.balances, ...MOCK_OTHER_ONCHAIN],
    btcFailed: btc.failed,
    sources: { prices: p.source, btc: btc.source, otherChains: 'mock' },
  };
}

/* ---------- Ledger automático: compras leídas de las transacciones de cada dirección ---------- */
const PRICE_CACHE = 'btc-price-cache:v1';
const purchaseCache = new Map(); // dirección -> compras (en memoria, para no repetir peticiones)
const readPriceCache = () => { try { return JSON.parse(localStorage.getItem(PRICE_CACHE)) || {}; } catch { return {}; } };

// Precio USD de BTC en el momento de un bloque (se guarda por día para no repetir peticiones)
async function priceAt(ts, cache) {
  const day = Math.floor(ts / 86400);
  if (cache[day] > 0) return cache[day];
  const j = await get(`${API}/v1/historical-price?currency=USD&timestamp=${ts}`);
  const p = j.prices?.[0]?.USD;
  if (!(p > 0)) throw new Error('sin precio histórico');
  return (cache[day] = p);
}

async function fetchTxs(address) {
  let page = await get(`${API}/address/${address}/txs`); // pendientes + primeras 25 confirmadas
  let txs = page;
  while (page.filter(t => t.status?.confirmed).length >= 25 && txs.length < 300) {
    page = await get(`${API}/address/${address}/txs/chain/${page[page.length - 1].txid}`);
    if (!page.length) break;
    txs = txs.concat(page);
  }
  return txs;
}

// Cada transacción confirmada que aumenta el saldo de la dirección cuenta como una compra
async function fetchPurchases(address, cache) {
  const out = [];
  for (const tx of await fetchTxs(address)) {
    if (!tx.status?.confirmed) continue;
    const recv = tx.vout.filter(o => o.scriptpubkey_address === address).reduce((t, o) => t + o.value, 0);
    const sent = tx.vin.filter(i => i.prevout?.scriptpubkey_address === address).reduce((t, i) => t + i.prevout.value, 0);
    if (recv - sent <= 0) continue;
    let price = null;
    try { price = await priceAt(tx.status.block_time, cache); } catch (e) { console.warn('Sin precio para', tx.txid, e.message); }
    out.push({ address, txid: tx.txid, date: new Date(tx.status.block_time * 1000).toISOString().slice(0, 10), amount: (recv - sent) / 1e8, price });
  }
  return out;
}

/** Llama a onUpdate(lista) cada vez que se lee una dirección nueva. */
export async function loadBtcLedger(addresses, onUpdate) {
  const cache = readPriceCache();
  const collect = () => addresses.flatMap(a => purchaseCache.get(a) || []).sort((x, y) => x.date.localeCompare(y.date));
  onUpdate(collect());
  for (const a of addresses) {
    if (purchaseCache.has(a)) continue;
    try {
      purchaseCache.set(a, await fetchPurchases(a, cache));
      try { localStorage.setItem(PRICE_CACHE, JSON.stringify(cache)); } catch {}
      onUpdate(collect());
    } catch (e) { console.warn('Compras no disponibles para', a, e.message); }
  }
}

/** Histórico guardado por GitHub Actions (data/history.json) */
export async function loadHistory() {
  try { const j = await get('data/history.json'); return Array.isArray(j) ? j : []; }
  catch { return []; }
}
