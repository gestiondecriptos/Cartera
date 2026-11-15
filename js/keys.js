// Claves de API opcionales (Helius para Solana, Moralis para EVM).
// En el navegador se guardan SOLO en este dispositivo (localStorage); en GitHub Actions vienen de los «Secrets».
const STORE = 'cripto-dashboard:keys';
export const KEY_NAMES = {
  HELIUS_API_KEY: 'Helius (Solana)',
  MORALIS_API_KEY: 'Moralis (EVM: respaldo para Base, Ethereum y Arbitrum)',
};

export function readKeys() {
  try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; }
}
export function setKeys(obj) {
  const clean = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v || '').trim()]).filter(([k, v]) => k in KEY_NAMES && v));
  try { localStorage.setItem(STORE, JSON.stringify(clean)); } catch { /* sin almacenamiento */ }
}
export function getKey(name) {
  const local = typeof localStorage !== 'undefined' ? readKeys()[name] : '';
  return local || (typeof process !== 'undefined' && process.env?.[name]) || '';
}
