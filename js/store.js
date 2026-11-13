// Estado persistente (localStorage) de los módulos manuales de la Pestaña 6.
import { STORAGE_KEY, INITIAL_SHARES, DUAL_ASSETS, CEX_ASSETS } from './config.js';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const BTC_ADDR = /^(bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;

const defaults = () => ({
  version: 1,
  dual: [],                                       // [{asset, amount, network:'BSC'}]
  dca: [],                                        // [{id, month:'2026-06', buyUsd, debt, ltv, btc}] (varias filas por mes)
  btcAddresses: [],                               // direcciones BTC extra (solo este navegador)
  cex: Object.fromEntries(CEX_ASSETS.map(a => [a, 0])),
  shares: { base: INITIAL_SHARES, movements: [] } // movements: [{date, type:'add'|'sub', qty, price}]
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const s = raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
    s.dca = s.dca.map(r => (r.id ? r : { ...r, id: uid() })); // datos guardados antes de este cambio
    s.btcAddresses = [...new Set([...(s.btcAddresses || []), ...(s.btcLedger || []).map(p => p.address)])]; // migración
    delete s.btcLedger;
    return s;
  } catch { return defaults(); }
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('No se pudo guardar en localStorage', e); }
  listeners.forEach(fn => fn(getState()));
}

export const getState = () => structuredClone(state);
export const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };

// Dual Investment: SOBRESCRIBE (no acumula). Solo BSC y BTCB/ETH/BNB/USDT.
export function setDualInvestment(positions) {
  state.dual = positions
    .filter(p => DUAL_ASSETS.includes(p.asset) && +p.amount > 0)
    .map(p => ({ asset: p.asset, amount: +p.amount, network: 'BSC' }));
  persist();
}

// CEX: SOBRESCRIBE (no acumula).
export function setCex(balances) {
  state.cex = Object.fromEntries(CEX_ASSETS.map(a => [a, Math.max(0, +balances[a] || 0)]));
  persist();
}

// DCA: cada guardado AÑADE una fila (puede haber varias compras en el mismo mes).
export function addDca(entry) {
  const row = { id: uid(), month: entry.month, buyUsd: +entry.buyUsd || 0, debt: +entry.debt || 0, ltv: +entry.ltv || 0, btc: +entry.btc || 0 };
  if (!row.month) throw new Error('Indica el mes.');
  state.dca = [...state.dca, row].sort((a, b) => a.month.localeCompare(b.month)); // orden estable dentro del mes
  persist();
}
export function removeDca(id) {
  state.dca = state.dca.filter(r => r.id !== id);
  persist();
}

// Direcciones BTC añadidas desde la web (solo en este navegador). Las compras se leen solas de mempool.space.
export function addBtcAddress(address, known = []) {
  address = String(address || '').trim();
  if (!BTC_ADDR.test(address)) throw new Error('La dirección BTC no parece válida.');
  if (known.includes(address) || state.btcAddresses.includes(address)) throw new Error('Esa dirección ya está en la lista.');
  state.btcAddresses = [...state.btcAddresses, address];
  persist();
}
export function removeBtcAddress(address) {
  state.btcAddresses = state.btcAddresses.filter(a => a !== address);
  persist();
}

// Participaciones: histórico de ampliaciones/reducciones
export const totalShares = () =>
  state.shares.base + state.shares.movements.reduce((t, m) => t + (m.type === 'add' ? m.qty : -m.qty), 0);

export function addShareMovement({ type, qty, price }) {
  qty = +qty; price = +price;
  if (!(qty > 0)) throw new Error('La cantidad debe ser mayor que 0.');
  if (type === 'sub' && qty > totalShares()) throw new Error('No puedes restar más participaciones de las que hay.');
  state.shares.movements.push({ date: new Date().toISOString(), type, qty, price: price || 0 });
  persist();
}

export function resetAll() { state = defaults(); persist(); }
