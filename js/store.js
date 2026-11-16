// Datos manuales: se leen del archivo data/manual.js (que editas en GitHub). Solo lectura.
import { INITIAL_SHARES, DUAL_ASSETS, CEX_ASSETS } from './config.js';

const num = v => (Number.isFinite(+v) ? +v : 0);

/** Convierte el contenido de data/manual.js en el formato que usa el motor contable */
export function normalizeManual(m = {}) {
  return {
    cex: Object.fromEntries(CEX_ASSETS.map(a => [a, Math.max(0, num(m.cex?.[a]))])),
    dual: DUAL_ASSETS.filter(a => num(m.dual?.[a]) > 0).map(a => ({ asset: a, amount: num(m.dual[a]), network: 'BSC' })),
    dualDebt: Math.max(0, num(m.dualDebtUSDT)),
    stakingManual: {
      ...(num(m.skyStaking) > 0 ? { SKY: num(m.skyStaking) } : {}),
      ...(num(m.psolStaking) > 0 ? { PSOL: num(m.psolStaking) } : {}),
    },
    shares: {
      base: m.shares?.base != null ? num(m.shares.base) : INITIAL_SHARES,
      movements: (m.shares?.movements || []).map(x => ({ date: String(x.date || ''), type: x.type === 'sub' ? 'sub' : 'add', qty: num(x.qty), price: num(x.price) })),
    },
    dca: (m.dca || []).map(r => ({ month: String(r.month || ''), buyUsd: num(r.buyUsd), debt: num(r.debt), ltv: num(r.ltv), btc: num(r.btc) })),   // en el orden del archivo: la última fila es la última línea
    poolEntries: Object.fromEntries(Object.entries(m.poolEntries || {})
      .filter(([, e]) => e && e.date && num(e.invested) > 0)
      .map(([id, e]) => [id, { date: String(e.date), invested: num(e.invested), a0: num(e.a0) > 0 ? num(e.a0) : null, a1: num(e.a1) > 0 ? num(e.a1) : null }])),
  };
}

let state = normalizeManual({}), loadError = null;

/** Lee data/manual.js (con un parámetro para saltarse la caché). No lanza: si falla, guarda el motivo en loadError */
export async function load() {
  try {
    const mod = await import(`../data/manual.js?v=${Date.now()}`);
    if (!mod.MANUAL) throw new Error('el archivo no contiene «export const MANUAL = {...}»');
    state = normalizeManual(mod.MANUAL);
    loadError = null;
  } catch (e) {
    loadError = /dynamically imported|Cannot find|Failed to fetch|not found|404/i.test(e.message) ? 'no se encuentra el archivo data/manual.js en el repositorio' : e.message;
  }
  return { error: loadError };
}

export const loadError_ = () => loadError;
export { loadError_ as loadError };
export const getState = () => structuredClone(state);
export const totalShares = () => state.shares.base + state.shares.movements.reduce((t, m) => t + (m.type === 'add' ? m.qty : -m.qty), 0);
