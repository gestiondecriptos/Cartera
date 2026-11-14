// Motor contable: funciones puras (no tocan la pantalla ni localStorage).
import { UNDERLYING } from './config.js';

// Prefijos de red que Aave v3 añade al nombre del aToken (aEthWETH, aBasWETH, aArbUSDC…)
const NET_RE = /^(Eth|Bas|Arb|Opt|Pol|Avax|Bnb|Gno|Scr|Lin|Mnt|Son)(?=[A-Za-z])/;

/**
 * Normaliza un símbolo:
 *  aEthWETH -> ETH, aLINK -> LINK, aAAVE -> AAVE   (colateral, suma al subyacente)
 *  variableDebtEthUSDC -> USDC con signo negativo   (deuda)
 *  WETH -> ETH, BTCB/WBTC -> BTC
 */
export function normalizeSymbol(raw) {
  let s = String(raw).trim(), sign = 1, aToken = false;
  const debt = s.match(/^(?:variable|stable)Debt(.+)$/);
  if (debt) {
    sign = -1;
    s = debt[1].replace(NET_RE, '');
  } else if (/^a[A-Z]/.test(s)) {
    aToken = true;
    s = s.slice(1).replace(NET_RE, '');
  }
  return { symbol: UNDERLYING[s] || s, sign, aToken };
}

const priceUsd = (symbol, prices, eurUsd) =>
  symbol === 'EUR' ? eurUsd : prices[symbol]?.usd ?? null;

const add = (obj, key, v) => { obj[key] = (obj[key] || 0) + v; };

/**
 * Une saldos on-chain + Dual Investment + CEX en una sola lista por activo real.
 * Cada item: { symbol, amount, network, custody, wallet?, category? }
 */
export function aggregateHoldings({ onchain = [], state, prices, eurUsd }) {
  const items = [
    ...onchain,
    ...state.dual.map(p => ({ symbol: p.asset, amount: p.amount, network: 'BSC', custody: 'exchange', category: 'dual' })),
    ...Object.entries(state.cex).map(([symbol, amount]) => ({ symbol, amount, network: 'CEX', custody: 'exchange', category: 'libre' })),
  ];
  const map = new Map();
  const by = { category: {}, custody: {}, network: {}, wallet: {} };
  const missing = new Set();
  let totalUsd = 0;

  for (const it of items) {
    if (!it.amount) continue;
    const n = normalizeSymbol(it.symbol);
    const px = priceUsd(n.symbol, prices, eurUsd);
    if (px == null) missing.add(n.symbol);
    const amount = it.amount * n.sign;
    const usd = amount * (px ?? 0);
    const category = n.sign < 0 ? 'deuda' : n.aToken ? 'colateral' : it.category || 'libre';

    const h = map.get(n.symbol) ?? { symbol: n.symbol, amount: 0, usd: 0, sources: [] };
    h.amount += amount;
    h.usd += usd;
    h.sources.push({ raw: it.symbol, amount, usd, network: it.network, custody: it.custody, category });
    map.set(n.symbol, h);

    add(by.category, category, usd);
    add(by.custody, it.custody, usd);
    add(by.network, it.network, usd);
    if (it.wallet) add(by.wallet, it.wallet, usd);
    totalUsd += usd;
  }
  return {
    holdings: [...map.values()].sort((a, b) => b.usd - a.usd),
    totalUsd, totalEur: totalUsd / eurUsd, by, missing: [...missing],
  };
}

/** Precio de participación = Valor total de la cartera / nº total de participaciones */
export function fundPrice(totalUsd, eurUsd, shares) {
  if (!shares || shares <= 0) return { usd: 0, eur: 0 };
  const usd = totalUsd / shares;
  return { usd, eur: usd / eurUsd };
}

/**
 * Tabla DCA (Pestaña 4):
 *  valueNoDebt  = BTC acumulado × precio actual − deuda acumulada
 *  buyPriceEst  = Compra (USD) × 1000 (se omite en la primera fila, junio)
 */
export function computeDcaTable(rows, btcPrice) {
  return rows.map((r, i) => ({
    ...r,
    valueNoDebt: r.btc * btcPrice - r.debt,
    buyPriceEst: i === 0 ? null : r.buyUsd * 1000,
  }));
}
