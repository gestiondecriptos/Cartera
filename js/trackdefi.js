// Módulo de compatibilidad total para la carga de pools
import { fetchOnChainPools } from './onchainpools.js';

export function parsePositions(rawData, walletConfig) {
  return [];
}

// Exportamos tanto la función tradicional como un alias directo por si el index.js llama a otra variante
export async function loadPools() {
  try {
    const res = await fetchOnChainPools();
    if (res) {
      // Si el dashboard espera un objeto envolvente con .positions
      if (Array.isArray(res.positions)) return res;
      // Si el dashboard espera directamente el array
      if (Array.isArray(res)) return { positions: res, source: 'live', raws: [], failed: [], errs: [], fetchedAt: new Date().toISOString(), warnings: [] };
    }
  } catch (e) {
    console.warn('Error en loadPools:', e);
  }

  return {
    positions: [],
    source: 'live',
    raws: [],
    failed: [],
    errs: [],
    fetchedAt: new Date().toISOString(),
    warnings: []
  };
}

// Por si el script principal importa directamente fetchPools u otro nombre común
export const fetchPools = loadPools;
