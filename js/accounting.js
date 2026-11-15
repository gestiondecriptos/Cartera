// Motor contable: funciones puras (no tocan la pantalla ni localStorage).
import { UNDERLYING, COINGECKO_IDS, LIQUID_STAKING } from './config.js';

// Prefijos de red que Aave v3 añade al nombre del aToken (aEthWETH, aBasWETH, aArbUSDC…)
const NET_RE = /^(Eth|Bas|Arb|Opt|Pol|Avax|Bnb|Gno|Scr|Lin|Mnt|Son|Uni)(?=[A-Za-z])/i;
const known = k => k in COINGECKO_IDS || k in UNDERLYING || k === 'EUR';
// quita el prefijo de red solo si lo que queda es un activo conocido (así «LINK» no pierde «LIN»)
const strip = x => (known(x) ? x : known(x.replace(NET_RE, '')) ? x.replace(NET_RE, '') : x);

/**
 * Normaliza un símbolo:
 *  aEthWETH, AWETH -> ETH · aLINK, ALINK -> LINK · aAAVE, AAAVE -> AAVE   (colateral, suma al subyacente)
 *  variableDebtArbUSDCn -> USDC con signo negativo                       (deuda)
 *  WETH -> ETH, BTCB/WBTC -> BTC
 */
export function normalizeSymbol(raw) {
  let s = String(raw).trim(), sign = 1, aToken = false;
  const debt = s.match(/^(?:variable|stable)debt(.+)$/i);
  if (debt) {
    sign = -1;
    s = strip(debt[1]);
  } else if (!known(s) && /^[aA][A-Z]/.test(s)) {
    const rest = strip(s.slice(1));
    if (/^a/.test(s) || known(rest)) { aToken = true; s = rest; }   // «aXxx» siempre; «AXXX» solo si lo que sigue es un activo conocido
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
    ...Object.entries(state.stakingManual || {}).map(([symbol, amount]) => ({ symbol, amount, network: 'Ethereum', custody: 'ledger', category: 'staking' })),
  ];
  const map = new Map();
  const by = { category: {}, custody: {}, network: {}, wallet: {} };
  const missing = new Set();
  let totalUsd = 0;

  for (const it of items) {
    if (!it.amount) continue;
    const n = normalizeSymbol(it.symbol);
    let symbol = n.symbol, amount = it.amount * n.sign;
    let px = priceUsd(symbol, prices, eurUsd) ?? it.priceUsd ?? null; // priceUsd del item: respaldo para tokens sin precio propio
    const base = LIQUID_STAKING[symbol];                              // p. ej. PSOL -> SOL (cantidad equivalente, mismo valor)
    if (base && prices[symbol]?.usd && prices[base]?.usd) { amount *= prices[symbol].usd / prices[base].usd; symbol = base; px = prices[base].usd; }
    if (px == null) missing.add(symbol);
    const usd = amount * (px ?? 0);
    const category = n.sign < 0 ? 'deuda' : n.aToken ? 'colateral' : it.category || 'libre';

    const h = map.get(symbol) ?? { symbol, amount: 0, usd: 0, sources: [] };
    h.amount += amount;
    h.usd += usd;
    h.sources.push({ raw: it.symbol, amount, usd, network: it.network, custody: it.custody, category });
    map.set(symbol, h);

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

/**
 * IL, tiempo y ROI de una posición de pool a partir de la entrada que registra el usuario.
 *  ROI neto = valor actual + comisiones pendientes − importe invertido (no incluye comisiones ya cobradas)
 *  IL = valor actual de la posición − valor de mantener las cantidades iniciales (sin comisiones). Negativo = pérdida.
 */
export function poolPerformance(p, e, now = Date.now()) {
  if (!e) return null;
  const days = Math.max(1, (now - Date.parse(e.date)) / 864e5);
  const roiUsd = p.valueUsd + p.rewardsUsd - e.invested, roiPct = roiUsd / e.invested * 100;
  let ilUsd = null, ilPct = null;
  if (e.a0 != null && e.a1 != null && p.tokens.length === 2) {
    const hodl = e.a0 * (p.tokens[0].priceUsd || 0) + e.a1 * (p.tokens[1].priceUsd || 0);
    if (hodl > 0) { ilUsd = p.valueUsd - hodl; ilPct = ilUsd / hodl * 100; }
  }
  return { days, roiUsd, roiPct, annualPct: roiPct * 365 / days, ilUsd, ilPct };
}
