// Saldos reales por red con APIs públicas gratuitas: EVM (Blockscout), Hyperliquid, Tron y Cosmos.
import { WALLETS, CHAINS, COINGECKO_IDS, STAKING_SYMBOLS } from './config.js';
import { normalizeSymbol } from './accounting.js';
import { getKey } from './keys.js';

// Reintenta si hay límite de peticiones (429), error del servidor (5xx) o fallo de red; los errores definitivos (404, 403…) no
const get = async (url, opts = {}) => {
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(12000) });
      if (r.ok) return await r.json();
      err = new Error(String(r.status));
      if (r.status !== 429 && r.status < 500) throw err;
    } catch (e) {
      if (e === err) throw e;
      err = e;
      if (i >= 1 || /timed out|abort|timeout/i.test(e.message)) break;   // tiempo agotado: sin reintento; otros fallos de red: un reintento
    }
    await new Promise(res => setTimeout(res, 800 * (i + 1)));
  }
  throw err;
};
// Motivo del fallo en lenguaje claro (se muestra bajo la tabla de activos)
const why = e => /^\d+$/.test(e.message) ? `error HTTP ${e.message}` : /timed out|abort/i.test(e.message) ? 'tiempo agotado' : /failed to fetch|network|load failed/i.test(e.message) ? 'sin conexión o bloqueado por el navegador' : e.message;
const post = (url, body) => get(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const orNull = p => p.catch(e => (e.message === '404' ? null : Promise.reject(e))); // cuenta nueva/vacía = sin saldo, no es un fallo
const short = a => (a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : a);
const known = symbol => { const s = normalizeSymbol(symbol).symbol; return s === 'EUR' || s in COINGECKO_IDS; };

// Cada función devuelve { items, failed, ignored, attempts }
// Máximo 3 lecturas a la vez, para no superar los límites de las APIs gratuitas
async function eachUnit(units, fn, limit = 3) {
  const out = { items: [], failed: [], ignored: [], attempts: units.length };
  let next = 0;
  const worker = async () => {
    while (next < units.length) {
      const u = units[next++];
      try { await fn(u, out); } catch (e) { console.warn('Fallo al leer', u.label, e.message); out.failed.push(`${u.label} (${why(e)})`); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, units.length) }, worker));
  return out;
}
const push = (out, base, symbol, amount, category) => {
  if (!(Math.abs(amount) > 0)) return;
  if (!known(symbol)) return out.ignored.push(symbol);
  const cat = category || (STAKING_SYMBOLS.includes(symbol.toUpperCase()) ? 'staking' : null);
  out.items.push({ ...base, symbol, amount, ...(cat ? { category: cat } : {}) });
};

/* ---- EVM: redes de CHAINS.evm en config.js (Blockscout) ---- */
export const fetchEvm = () => eachUnit(
  WALLETS.evm.flatMap(w => CHAINS.evm.map(net => ({ w, net, label: `${net.name} ${short(w.address)}` }))),
  async ({ w, net }, out) => {
    const mKey = getKey('MORALIS_API_KEY');
    // Blockscout (sin clave) y, si hay clave de Moralis, Moralis: se prueba el preferido y el otro queda de respaldo
    const viaBlockscout = async () => {
      const acc = await orNull(get(`${net.api}/api/v2/addresses/${w.address}`));
      const list = [[net.native, Number(acc?.coin_balance || 0) / 1e18]];
      const add = items => { for (const t of items || []) { const tk = t.token || {}; if ((!tk.type || tk.type === 'ERC-20') && tk.symbol) list.push([tk.symbol, Number(t.value) / 10 ** Number(tk.decimals ?? 18)]); } };
      try {
        // Solo tokens ERC-20 (sin NFTs, que son lo que suele agotar el tiempo), paginado
        let extra = '', pages = 0;
        do {
          const j = await orNull(get(`${net.api}/api/v2/addresses/${w.address}/tokens?type=ERC-20${extra}`));
          add(j?.items);
          const np = j?.next_page_params;
          extra = np ? '&' + Object.entries(np).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') : '';
          pages++;
        } while (extra && pages < 6);
      } catch (e) {
        if (!/^(400|404|422)$/.test(e.message)) throw e;          // si esa ruta no existe en la instancia, se usa la antigua
        list.length = 1;
        add(await orNull(get(`${net.api}/api/v2/addresses/${w.address}/token-balances`)));
      }
      return list;
    };
    const viaMoralis = async () => {
      const list = [];
      let cursor = null, pages = 0;
      do {
        const url = `https://deep-index.moralis.io/api/v2.2/wallets/${w.address}/tokens?chain=${net.moralis}&exclude_spam=true&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`;
        const j = await get(url, { headers: { 'X-API-Key': mKey } });
        for (const t of j.result || []) if (!t.possible_spam) list.push([t.native_token ? net.native : t.symbol, Number(t.balance_formatted)]);
        cursor = j.cursor; pages++;
      } while (cursor && pages < 5);
      return list;
    };
    const methods = mKey && net.moralis
      ? (net.prefer === 'moralis' ? [['Moralis', viaMoralis], ['Blockscout', viaBlockscout]] : [['Blockscout', viaBlockscout], ['Moralis', viaMoralis]])
      : [['Blockscout', viaBlockscout]];
    const errs = [];
    for (const [name, fn] of methods) {
      try {
        const base = { network: net.name, wallet: short(w.address), custody: w.custody };
        for (const [symbol, amount] of await fn()) push(out, base, symbol, amount);
        return;
      } catch (e) { errs.push(`${name}: ${why(e)}`); }
    }
    throw new Error(errs.join('; '));
  });

/* ---- BSC: BNB y tokens BEP-20 de config.js (RPC público, sin clave) ---- */
const bscCall = (method, params) => post(CHAINS.bsc.rpc, { jsonrpc: '2.0', id: 1, method, params })
  .then(j => { if (j.error) throw new Error(j.error.message); return j.result; });
const hexToNum = (hex, dec) => Number(BigInt(hex && hex !== '0x' ? hex : '0x0')) / 10 ** dec;
export const fetchBsc = () => eachUnit(
  WALLETS.evm.map(w => ({ w, label: `BSC ${short(w.address)}` })),
  async ({ w }, out) => {
    const base = { network: 'BSC', wallet: short(w.address), custody: w.custody };
    const data = '0x70a08231' + w.address.slice(2).toLowerCase().padStart(64, '0');        // balanceOf(address)
    const [native, ...tokens] = await Promise.all([
      bscCall('eth_getBalance', [w.address, 'latest']),
      ...Object.keys(CHAINS.bsc.tokens).map(to => bscCall('eth_call', [{ to, data }, 'latest'])),
    ]);
    push(out, base, CHAINS.bsc.native, hexToNum(native, 18));
    Object.values(CHAINS.bsc.tokens).forEach((symbol, i) => push(out, base, symbol, hexToNum(tokens[i], 18)));
  });

/* ---- Hyperliquid: spot, margen de perpetuos y HYPE en staking ---- */
export const fetchHyperliquid = () => eachUnit(
  WALLETS.evm.map(w => ({ w, label: `Hyperliquid ${short(w.address)}` })),
  async ({ w }, out) => {
    const call = type => post(CHAINS.hyperliquid, { type, user: w.address });
    const [spot, perp, deleg] = await Promise.all([call('spotClearinghouseState'), call('clearinghouseState'), call('delegatorSummary')]);
    const base = { network: 'Hyperliquid', wallet: short(w.address), custody: w.custody };
    for (const b of spot.balances || []) push(out, base, b.coin, Number(b.total));
    push(out, base, 'USDC', Number(perp.marginSummary?.accountValue || 0));          // margen + PnL de perpetuos
    push(out, base, 'HYPE', Number(deleg.delegated || 0), 'staking');
    push(out, base, 'HYPE', Number(deleg.undelegated || 0) + Number(deleg.totalPendingWithdrawal || 0));
  });

/* ---- Tron: TRX, TRX en staking (Stake 2.0 y 1.0) y TRC-20 ---- */
export const fetchTron = () => eachUnit(
  WALLETS.tron.map(a => ({ a, label: `Tron ${short(a)}` })),
  async ({ a }, out) => {
    const acc = (await orNull(get(`${CHAINS.tronApi}/v1/accounts/${a}`)))?.data?.[0];
    if (!acc) return;
    const base = { network: 'Tron', wallet: short(a), custody: 'ledger' };
    const sum = (list, key) => (list || []).reduce((t, x) => t + (Number(x[key]) || 0), 0);
    const staked = sum(acc.frozenV2, 'amount') + sum(acc.frozen, 'frozen_balance') + Number(acc.account_resource?.frozen_balance_for_energy?.frozen_balance || 0);
    push(out, base, 'TRX', (acc.balance || 0) / 1e6);
    push(out, base, 'TRX', staked / 1e6, 'staking');
    push(out, base, 'TRX', sum(acc.unfrozenV2, 'unfreeze_amount') / 1e6);              // pendiente de retirar
    for (const t of acc.trc20 || []) for (const [contract, raw] of Object.entries(t)) {
      const m = CHAINS.tronTokens[contract];
      if (m) push(out, base, m.symbol, Number(raw) / 10 ** m.decimals);
    }
  });

/* ---- Cosmos Hub: ATOM libre, delegado y recompensas pendientes ---- */
async function cosmosGet(path) {
  let err;
  for (const base of CHAINS.cosmosRest) { try { return await get(base + path); } catch (e) { err = e; } }
  throw err;
}
export const fetchCosmos = () => eachUnit(
  WALLETS.cosmos.map(a => ({ a, label: `Cosmos ${short(a)}` })),
  async ({ a }, out) => {
    const [bank, del, rew] = await Promise.all([
      cosmosGet(`/cosmos/bank/v1beta1/balances/${a}`),
      cosmosGet(`/cosmos/staking/v1beta1/delegations/${a}`),
      cosmosGet(`/cosmos/distribution/v1beta1/delegators/${a}/rewards`).catch(() => ({ total: [] })),
    ]);
    const base = { network: 'Cosmos', wallet: short(a), custody: 'ledger' };
    const atom = list => (list || []).filter(x => x.denom === 'uatom').reduce((t, x) => t + Number(x.amount || 0), 0) / 1e6;
    push(out, base, 'ATOM', atom(bank.balances));
    push(out, base, 'ATOM', atom((del.delegation_responses || []).map(d => d.balance)), 'staking');
    push(out, base, 'ATOM', atom(rew.total), 'staking');
  });

/** Lee todas las redes en paralelo. status: live | partial (alguna lectura falló) | mock (todas fallaron) */
export async function loadChains(onPart) {
  const jobs = { evm: fetchEvm, bsc: fetchBsc, hyperliquid: fetchHyperliquid, tron: fetchTron, cosmos: fetchCosmos };
    const sources = {}, items = {}, failed = [], ignored = new Set();
  const snap = () => ({ sources: { ...sources }, items: { ...items }, failed: [...failed], ignored: [...ignored] });
  await Promise.all(Object.entries(jobs).map(async ([name, fn]) => {
    let r;
    try { r = await fn(); } catch (e) { r = { items: [], failed: [`${name} (${why(e)})`], ignored: [], attempts: 1 }; }
    sources[name] = !r.failed.length ? 'live' : r.failed.length >= r.attempts ? 'none' : 'partial';
    items[name] = r.items;
    failed.push(...r.failed);
      r.ignored.forEach(s => ignored.add(s));
    onPart?.(snap());
  }));
  return snap();
}
