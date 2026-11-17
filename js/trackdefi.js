// Pools de liquidez reales: API de TrackDeFi (https://trackdefi.app/api/positions?address=...)
import { WALLETS, TRACKDEFI_URL, COINGECKO_IDS, IGNORE_POOLS } from './config.js';
import { fetchOnChainPools } from './onchainpools.js';

const CHAIN_NAMES = { 1: 'Ethereum', 10: 'Optimism', 56: 'BSC', 130: 'Unichain', 137: 'Polygon', 8453: 'Base', 42161: 'Arbitrum', 43114: 'Avalanche', 42220: 'Celo', 999: 'Hyperliquid' };
const short = a => a.slice(0, 6) + '…' + a.slice(-4);
const canon = s => (s in COINGECKO_IDS ? s : s.toUpperCase() in COINGECKO_IDS ? s.toUpperCase() : s); // «Cake» -> «CAKE»

function analyse(range, tokens) {
  if (!range) return { status: 'Sin rango (V2)', color: '#94a3b8' };
  const w = range.upper - range.lower, frac = w ? (range.current - range.lower) / w : 0.5;
  if (range.inRange) return { status: 'En rango', color: frac < 0.1 || frac > 0.9 ? '#fbbf24' : '#22c55e' };
  const full = tokens.find(t => t.amount > 0 && tokens.every(o => o === t || o.amount === 0));
  return { status: `Fuera de rango${full ? ` - 100% ${full.symbol}` : ''}`, color: '#ef4444' };
}

/** Convierte la respuesta de TrackDeFi de una dirección en posiciones listas para pintar y contabilizar */
export function parsePositions(raw, wallet) {
  return (raw?.positions || []).filter(p => !IGNORE_POOLS.includes(p.poolSymbol)).map(p => {
    const tokens = [p.token0, p.token1].filter(Boolean).map(t => ({ symbol: canon(t.symbol), amount: +t.amount || 0, valueUsd: +t.valueUsd || 0, priceUsd: +t.priceUsd || null }));
    const rewards = (p.rewards || []).map(r => ({ symbol: canon(r.symbol), kind: r.kind, amount: +r.amount || 0, valueUsd: +r.valueUsd || 0, priceUsd: +r.priceUsd || null }));
    const range = p.range ? { inRange: !!p.range.inRange, lower: +p.range.lower, upper: +p.range.upper, current: +p.range.current, quoteLabel: p.range.quoteLabel || '' } : null;
    return {
      id: `${p.chainId}:${p.positionId ?? p.poolAddress}`, protocol: p.protocol, network: CHAIN_NAMES[p.chainId] || `Red ${p.chainId}`,
      pair: p.poolSymbol, kind: p.kind, staked: !!p.staked, wallet: short(wallet.address), custody: wallet.custody,
      tokens, rewards, valueUsd: +p.valueUsd || 0, rewardsUsd: +p.rewardsUsd || 0, range, ...analyse(range, tokens),
    };
  });
}

/** Cada token del pool y cada comisión pendiente se suma a su activo real (categoría «pools») */
export const poolItems = positions => positions.flatMap(p => [...p.tokens, ...p.rewards].map(t => (
  { symbol: t.symbol, amount: t.amount, priceUsd: t.priceUsd, network: p.network, wallet: p.wallet, custody: p.custody, category: 'pools' })));

/**
 * Lee las posiciones de todas tus direcciones EVM.
 * source: live (API directa) · partial (alguna dirección falló) · file (data/pools.json guardado por el workflow, si el navegador no puede llamar a la API) · none
 */

export async function fetchPools({ allowFile = typeof document !== 'undefined' } = {}) {
  try {
    const res = await fetchOnChainPools();
    if (res && res.positions && res.positions.length > 0) {
      return res;
    }
  } catch (e) {
    console.warn('Pools on-chain fallaron, usando respaldo de TrackDeFi:', e.message);
  }
  let results = [], failed = [], errs = [], source;
  await Promise.all(WALLETS.evm.map(async w => {
    try {
      const r = await fetch(`${TRACKDEFI_URL}?address=${w.address}`, { signal: AbortSignal.timeout(45000) });
      if (!r.ok) throw new Error(String(r.status));
      results.push({ address: w.address, data: await r.json() });
    } catch (e) { console.warn('TrackDeFi: no se pudo leer', w.address, e.message); failed.push(w.address); errs.push(e.message); }
  }));
  source = !failed.length ? 'live' : results.length ? 'partial' : 'none';
  let fetchedAt = results.map(r => r.data.fetchedAt).filter(Boolean).sort()[0] || null;

  if (source === 'none' && allowFile) {
    try {
      const f = await fetch('data/pools.json');
      const j = f.ok ? await f.json() : null;
      if (j?.results?.length) { results = j.results; source = 'file'; fetchedAt = j.fetchedAt || null; }
    } catch { /* sin archivo */ }
  }
  const positions = results.flatMap(({ address, data }) => parsePositions(data, WALLETS.evm.find(w => w.address === address) || { address, custody: 'ledger' }));
  const warnings = [...new Set(results.flatMap(r => r.data.warnings || []))];
  return { positions, source, raws: results, failed, errs, fetchedAt, warnings };
}
