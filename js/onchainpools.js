// Pools V3 leídos directamente de la blockchain (sin TrackDeFi). Hoy: PancakeSwap V3 en BSC (incluye posiciones en farming).
// Para añadir otra red/protocolo (p. ej. Uniswap v3 en Unichain) basta con añadir una entrada a POOL_CHAINS.
import { WALLETS, CHAINS, COINGECKO_IDS, IGNORE_POOLS } from './config.js';
import { normalizeSymbol } from './accounting.js';
import * as store from './store.js';

const POOL_CHAINS = [
  { chainId: 56, network: 'BSC', protocol: 'pancakeswap-v3', rpc: CHAINS.bsc.rpc,
    npm: '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364',    // NonfungiblePositionManager de Pancake V3
    farm: '0x556B9306565093C855AEA9AE92A594704c2Cd59e' },  // MasterChef V3 (custodia los NFT en farming)
];
const SEL = { positions: '0x99fbab88', ownerOf: '0x6352211e', balanceOf: '0x70a08231', byIndex: '0x2f745c59', factory: '0xc45a0155',
  getPool: '0x1698ee82', slot0: '0x3850c7bd', collect: '0xfc6f7865', decimals: '0x313ce567', symbol: '0x95d89b41', pendingCake: '0xce5f39c6' };

const pad = h => h.replace(/^0x/, '').padStart(64, '0');
const aArg = a => pad(a.toLowerCase());
const nArg = n => pad(BigInt(n).toString(16));
const words = hex => hex.slice(2).match(/.{64}/g) || [];
const big = w => BigInt('0x' + w);
const signed = w => { const b = big(w); return b >= 2n ** 255n ? b - 2n ** 256n : b; };
const addr = w => '0x' + w.slice(24);
const short = a => a.slice(0, 6) + '…' + a.slice(-4);
const canon = s => (s in COINGECKO_IDS ? s : s.toUpperCase() in COINGECKO_IDS ? s.toUpperCase() : s);

/** Varias eth_call en una sola petición (batch JSON-RPC). Devuelve un array con el resultado en hex o null si esa llamada falla/revierte */
async function rpc(url, calls) {
  const out = new Array(calls.length).fill(null);
  const post = async b => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`RPC ${r.status}`);
    return r.json();
  };
  for (let i = 0; i < calls.length; i += 40) {
    const body = calls.slice(i, i + 40).map((c, k) => ({ jsonrpc: '2.0', id: i + k, method: 'eth_call', params: [{ to: c.to, data: c.data, ...(c.from ? { from: c.from } : {}) }, 'latest'] }));
    let res;
    try { res = await post(body); if (!Array.isArray(res)) throw new Error('sin batch'); }
    catch { res = await Promise.all(body.map(b => post(b).catch(() => null))); }   // si el RPC no admite batch: llamadas sueltas en paralelo
    for (const r of res) if (r && typeof r.result === 'string' && r.result.length > 2) out[r.id] = r.result;
  }
  return out;
}
const hexToStr = h => { let t = ''; for (let i = 0; i < h.length; i += 2) { const c = parseInt(h.slice(i, i + 2), 16); if (c) t += String.fromCharCode(c); } return t; };
const str = hex => {   // string ABI dinámico o bytes32
  if (!hex) return null;
  const w = words(hex);
  if (w.length >= 3 && big(w[0]) === 32n) return hexToStr(w.slice(2).join('').slice(0, Number(big(w[1])) * 2));
  return hexToStr(hex.slice(2));
};

/** Tokens de una posición V3 a partir de su liquidez, rango y precio actual (fórmulas estándar de Uniswap V3) */
export function v3Amounts(L, sqrtX96, tickLower, tickUpper) {
  const sa = Math.pow(1.0001, tickLower / 2), sb = Math.pow(1.0001, tickUpper / 2), sp = Number(sqrtX96) / 2 ** 96, l = Number(L);
  if (sp <= sa) return [l * (sb - sa) / (sa * sb), 0];
  if (sp >= sb) return [0, l * (sb - sa)];
  return [l * (sb - sp) / (sp * sb), l * (sp - sa)];
}

async function readChain(cfg, wallets, prices, knownIds, errs) {
  const MAX = (2n ** 128n - 1n);
  const call = (to, sel, ...args) => ({ to, data: sel + args.join('') });
  const px = sym => prices[normalizeSymbol(sym).symbol]?.usd || null;

  // Ronda 1: nº de NFT de cada wallet (en su cartera y en farming), factory y posiciones ya conocidas
  const w0 = wallets.map(w => w.address);
  const r1 = await rpc(cfg.rpc, [
    call(cfg.npm, SEL.factory),
    ...w0.flatMap(a => [call(cfg.npm, SEL.balanceOf, aArg(a)), call(cfg.farm, SEL.balanceOf, aArg(a))]),
  ]);
  if (!r1[0]) throw new Error(`RPC de ${cfg.network} sin respuesta`);
  const factory = addr(words(r1[0])[0]);

  // Ronda 2: ids de las posiciones de cada wallet (si el farm no admite enumerar, se usan los ids de poolEntries)
  const idCalls = [];
  w0.forEach((a, i) => {
    const nNpm = Math.min(Number(r1[1 + 2 * i] ? big(words(r1[1 + 2 * i])[0]) : 0n), 40), nFarm = Math.min(Number(r1[2 + 2 * i] ? big(words(r1[2 + 2 * i])[0]) : 0n), 40);
    for (let k = 0; k < nNpm; k++) idCalls.push(call(cfg.npm, SEL.byIndex, aArg(a), nArg(k)));
    for (let k = 0; k < nFarm; k++) idCalls.push(call(cfg.farm, SEL.byIndex, aArg(a), nArg(k)));
  });
  const r2 = await rpc(cfg.rpc, idCalls);
  const ids = [...new Set([...knownIds, ...r2.filter(Boolean).map(h => big(words(h)[0]).toString())])];
  if (!ids.length) return [];

  // Ronda 3: datos de cada posición y de quién es el NFT
  const r3 = await rpc(cfg.rpc, ids.flatMap(id => [call(cfg.npm, SEL.positions, nArg(id)), call(cfg.npm, SEL.ownerOf, nArg(id))]));
  const pos = [];
  ids.forEach((id, i) => {
    const d = r3[2 * i], o = r3[2 * i + 1];
    if (!d || !o) return;                                  // NFT quemado (posición cerrada)
    const w = words(d), owner = addr(words(o)[0]);
    const mine = w0.find(a => a.toLowerCase() === owner.toLowerCase());
    const staked = owner.toLowerCase() === cfg.farm.toLowerCase();
    if (!mine && !staked) return;                          // pertenece a otra persona
    const p = { id, owner, staked, wallet: wallets.find(x => x.address.toLowerCase() === (mine || '').toLowerCase()) || wallets[0],
      t0: addr(w[2]), t1: addr(w[3]), fee: Number(big(w[4])), tl: Number(signed(w[5])), tu: Number(signed(w[6])), L: big(w[7]) };
    if (p.L > 0n) pos.push(p);
  });
  if (!pos.length) return [];

  // Ronda 4: símbolo y decimales de los tokens + dirección de cada pool
  const toks = [...new Set(pos.flatMap(p => [p.t0, p.t1]))];
  const pools = [...new Set(pos.map(p => `${p.t0}|${p.t1}|${p.fee}`))];
  const r4 = await rpc(cfg.rpc, [...toks.flatMap(t => [call(t, SEL.symbol), call(t, SEL.decimals)]), ...pools.map(k => { const [a, b, f] = k.split('|'); return call(factory, SEL.getPool, aArg(a), aArg(b), nArg(f)); })]);
  const meta = {};
  toks.forEach((t, i) => { meta[t] = { symbol: canon(str(r4[2 * i]) || short(t)), dec: r4[2 * i + 1] ? Number(big(words(r4[2 * i + 1])[0])) : 18 }; });
  const poolAddr = {};
  pools.forEach((k, i) => { const h = r4[2 * toks.length + i]; poolAddr[k] = h ? addr(words(h)[0]) : null; });

  // Ronda 5: precio actual de cada pool, comisiones pendientes (collect simulado desde el dueño del NFT) y CAKE pendiente del farm
  const r5 = await rpc(cfg.rpc, [
    ...pools.map(k => poolAddr[k] ? call(poolAddr[k], SEL.slot0) : { to: cfg.npm, data: '0x' }),
    ...pos.map(p => ({ to: cfg.npm, from: p.owner, data: SEL.collect + nArg(p.id) + aArg(p.wallet.address) + pad(MAX.toString(16)) + pad(MAX.toString(16)) })),
    ...pos.map(p => p.staked ? call(cfg.farm, SEL.pendingCake, nArg(p.id)) : { to: cfg.npm, data: '0x' }),
  ]);
  const slot = {}; pools.forEach((k, i) => { if (r5[i]) { const w = words(r5[i]); slot[k] = { sqrt: big(w[0]), tick: Number(signed(w[1])) }; } });

  const cakeUsd = px('CAKE');
  return pos.map((p, i) => {
    const k = `${p.t0}|${p.t1}|${p.fee}`, s = slot[k], m0 = meta[p.t0], m1 = meta[p.t1];
    if (!s) { errs.push(`pool ${p.id}: sin precio actual`); return null; }
    const [a0r, a1r] = v3Amounts(p.L, s.sqrt, p.tl, p.tu), a0 = a0r / 10 ** m0.dec, a1 = a1r / 10 ** m1.dec;
    const ratio = (Number(s.sqrt) / 2 ** 96) ** 2 * 10 ** (m0.dec - m1.dec);            // token1 por token0
    let p0 = px(m0.symbol), p1 = px(m1.symbol);
    if (!p0 && p1) p0 = ratio * p1; if (!p1 && p0) p1 = p0 / ratio;
    const fee = r5[pools.length + i] ? words(r5[pools.length + i]) : null;
    const f0 = fee ? Number(big(fee[0])) / 10 ** m0.dec : 0, f1 = fee ? Number(big(fee[1])) / 10 ** m1.dec : 0;
    const cake = r5[pools.length + pos.length + i] ? Number(big(words(r5[pools.length + pos.length + i])[0])) / 1e18 : 0;
    const tokens = [{ symbol: m0.symbol, amount: a0, priceUsd: p0, valueUsd: a0 * (p0 || 0) }, { symbol: m1.symbol, amount: a1, priceUsd: p1, valueUsd: a1 * (p1 || 0) }];
    const rewards = [{ symbol: m0.symbol, kind: 'fees', amount: f0, priceUsd: p0, valueUsd: f0 * (p0 || 0) }, { symbol: m1.symbol, kind: 'fees', amount: f1, priceUsd: p1, valueUsd: f1 * (p1 || 0) },
      ...(cake > 0 ? [{ symbol: 'CAKE', kind: 'reward', amount: cake, priceUsd: cakeUsd, valueUsd: cake * (cakeUsd || 0) }] : [])].filter(r => r.amount > 0);
    // Rango: precio del token más valioso expresado en el otro
    const lo = 1.0001 ** p.tl * 10 ** (m0.dec - m1.dec), up = 1.0001 ** p.tu * 10 ** (m0.dec - m1.dec), inv = (p0 || 0) < (p1 || 0);
    const range = { inRange: s.tick >= p.tl && s.tick < p.tu, lower: inv ? 1 / up : lo, upper: inv ? 1 / lo : up, current: inv ? 1 / ratio : ratio, quoteLabel: inv ? m0.symbol : m1.symbol };
    const w = range.upper - range.lower, frac = w ? (range.current - range.lower) / w : .5;
    const full = tokens.find(t => t.amount > 0 && tokens.every(o => o === t || o.amount === 0));
    const status = range.inRange ? 'En rango' : `Fuera de rango${full ? ` - 100% ${full.symbol}` : ''}`;
    const color = range.inRange ? (frac < 0.1 || frac > 0.9 ? '#fbbf24' : '#22c55e') : '#ef4444';
    return { id: `${cfg.chainId}:${p.id}`, protocol: cfg.protocol, network: cfg.network, pair: `${m0.symbol}/${m1.symbol}`, kind: 'v3', staked: p.staked,
      wallet: short(p.wallet.address), custody: p.wallet.custody, tokens, rewards, valueUsd: tokens.reduce((t, x) => t + x.valueUsd, 0),
      rewardsUsd: rewards.reduce((t, x) => t + x.valueUsd, 0), range, status, color };
  }).filter(Boolean);
}

/** Lee todas las posiciones de las wallets marcadas con pools:true en config.js */
export async function fetchPoolsOnchain(prices, ready) {
  await ready;
  const wallets = WALLETS.evm.filter(w => w.pools);
  const errs = [], positions = [];
  if (wallets.length) {
    const entries = Object.keys(store.getState().poolEntries);
    for (const cfg of POOL_CHAINS) {
      const known = entries.filter(id => id.startsWith(cfg.chainId + ':')).map(id => id.split(':')[1]);
      positions.push(...(await readChain(cfg, wallets, prices, known, errs)));
    }
  }
  const list = positions.filter(p => !IGNORE_POOLS.includes(p.pair));
  return { positions: list, source: errs.length ? 'partial' : 'live', raws: [], failed: [], errs, fetchedAt: null, warnings: [] };
}
