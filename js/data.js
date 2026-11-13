// Capa de datos: intenta la API real y, si falla (CORS, límite de peticiones, sin red), usa datos simulados.
import { WALLETS, COINGECKO_IDS } from './config.js';
import { MOCK_PRICES, MOCK_EUR_USD, MOCK_BTC_ONCHAIN, MOCK_OTHER_ONCHAIN } from './mock-data.js';

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

async function fetchBtcOnchain() {
  try {
    const out = [];
    for (const address of WALLETS.btc) {
      const j = await get(`https://mempool.space/api/address/${address}`);
      const c = j.chain_stats, m = j.mempool_stats;
      const sats = c.funded_txo_sum - c.spent_txo_sum + m.funded_txo_sum - m.spent_txo_sum;
      out.push({ symbol: 'BTC', amount: sats / 1e8, network: 'Bitcoin', wallet: address, custody: 'ledger' });
    }
    return { balances: out, source: 'live' };
  } catch (e) {
    console.warn('BTC on-chain: usando datos simulados.', e.message);
    return { balances: MOCK_BTC_ONCHAIN, source: 'mock' };
  }
}

// Fase 1: BTC (mempool.space) es real; EVM/Solana/Tron/Cosmos siguen simulados hasta las fases siguientes.
export async function loadMarketData() {
  const [p, btc] = await Promise.all([fetchPrices(), fetchBtcOnchain()]);
  return {
    prices: p.prices,
    eurUsd: p.eurUsd,
    onchain: [...btc.balances, ...MOCK_OTHER_ONCHAIN],
    sources: { prices: p.source, btc: btc.source, otherChains: 'mock' },
  };
}
