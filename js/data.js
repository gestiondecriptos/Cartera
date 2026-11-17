// Capa de datos: intenta la API real y, si falla (CORS, límite de peticiones, sin red), usa datos simulados.
import { WALLETS, COINGECKO_IDS, APR_SOURCES } from './config.js';
import { loadChains } from './chains.js';
import { fetchPools, poolItems } from './trackdefi.js';
import { MOCK_PRICES, MOCK_EUR_USD } from './mock-data.js';

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

/** Saldos on-chain. Una dirección que falla no tumba a las demás; si fallan todas, se usan datos simulados. */
async function fetchBtcOnchain(addresses) {
  const out = [], failed = [];
    await Promise.all(addresses.map(async address => {
    try {
      const j = await get(`${API}/address/${address}`);
      const c = j.chain_stats, m = j.mempool_stats;
      const sats = c.funded_txo_sum - c.spent_txo_sum + m.funded_txo_sum - m.spent_txo_sum;
      out.push({ symbol: 'BTC', amount: sats / 1e8, network: 'Bitcoin', wallet: address, custody: 'ledger' });
    } catch (e) { console.warn('BTC on-chain: no se pudo leer', address, e.message); failed.push(address); }
  }));
  if (!out.length) return { balances: [], source: 'none', failed };   // sin datos inventados: el total no los incluye y la etiqueta lo avisa
  return { balances: out, source: 'live', failed };
}

export async function loadMarketData(btcAddresses = WALLETS.btc, onUpdate) {
  const part = { btc: null, chains: null, pools: null };
  let p = null;
  const CH = ['evm', 'bsc', 'hyperliquid', 'tron', 'cosmos'];
  const build = () => {
    const c = part.chains || { items: {}, sources: {}, failed: [], ignored: [] };
    const pl = part.pools || { positions: [], source: 'loading', raws: [], failed: [], fetchedAt: null, warnings: [] };
    return {
      prices: p.prices,
      eurUsd: p.eurUsd,
      onchain: [...(part.btc?.balances || []), ...Object.values(c.items).flat(), ...poolItems(pl.positions)],
      pools: pl,
      btcFailed: part.btc?.failed || [],
      chainFailed: c.failed,
      ignored: c.ignored,
      sources: { prices: p.source, btc: part.btc?.source ?? 'loading', ...Object.fromEntries(CH.map(k => [k, c.sources[k] ?? 'loading'])), pools: pl.source },
    };
  };
  const push = () => { if (p && onUpdate) onUpdate(build()); };
  await Promise.all([
    fetchPrices().then(r => { p = r; push(); }),
    fetchBtcOnchain(btcAddresses).then(r => { part.btc = r; push(); }),
    loadChains(c => { part.chains = c; push(); }).then(c => { part.chains = c; }),
    fetchPools().catch(e => ({ positions: [], source: 'none', raws: [], failed: [], errs: ['Error interno: ' + e.message], fetchedAt: null, warnings: [] })).then(r => { part.pools = r; push(); }),
  ]);
  return build();
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

/**
 * APR de staking desde DefiLlama (API pública de yields). Se guarda 12 h en el navegador.
 * Devuelve {TOKEN: {apr, label}}. Si la API no responde o ya no es gratuita, devuelve {} y se usan APR de ejemplo.
 */
export async function loadStakingApr() {
  const KEY = 'cripto-dashboard:apr2';
  try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && Date.now() - c.t < 12 * 3600e3) return c.aprs; } catch { /* sin caché */ }
  try {
    const r = await fetch('https://yields.llama.fi/pools', { signal: AbortSignal.timeout(40000) });
    if (!r.ok) throw new Error(String(r.status));
    const pools = (await r.json()).data || [];
    const aprs = {};
    for (const [sym, rules] of Object.entries(APR_SOURCES)) {
      for (const f of rules) {
        const hit = pools.filter(p => Number.isFinite(p.apy) && p.apy >= 0 && p.apy < 50 && !p.outlier   // se descartan APR absurdos
          && (!f.project || String(p.project).toLowerCase().includes(f.project))
          && (!f.symbol || String(p.symbol).toUpperCase() === f.symbol.toUpperCase())
          && (!f.chain || String(p.chain).toLowerCase() === f.chain.toLowerCase())).sort((a, b) => b.tvlUsd - a.tvlUsd)[0];
        if (hit) { aprs[sym] = { apr: hit.apy, label: `DefiLlama · ${hit.project}${f.approx ? ' (aprox.)' : ''}` }; break; }
      }
    }
    if (Object.keys(aprs).length) try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), aprs })); } catch { /* sin almacenamiento */ }
    return aprs;
  } catch (e) { console.warn('DefiLlama no disponible:', e.message); return {}; }
}
/** Histórico diario de precio BTC en USD desde Bitview (desde 2010, caché 12 h) */
export async function loadBtcEurHistory() {
  const KEY = 'cripto-dashboard:btc-usd-hist:v1';
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && Date.now() - c.t < 12 * 3600e3 && c.map && Object.keys(c.map).length) return c.map;
  } catch { /* sin caché */ }
  try {
    const r = await fetch('https://bitview.space/api/series/price_close/day1?start=2015-01-01', { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const maxV = (j.data || []).reduce((m, x) => (x != null && +x > m ? +x : m), 0);
    const cents = /cent/i.test(String(j.type || '')) || maxV > 5e6;
    const t0 = Date.parse('2015-01-01');
    const map = {};
    (j.data || []).forEach((v, i) => {
      if (v != null && +v > 0) map[new Date(t0 + i * 864e5).toISOString().slice(0, 10)] = cents ? +v / 100 : +v;
    });
    if (Object.keys(map).length) {
      try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), map })); } catch {}
    }
    return map;
  } catch (e) {
    console.warn('Bitview histórico BTC no disponible:', e.message);
    return {};
  }
}
