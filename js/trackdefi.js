// Módulo unificado de compatibilidad para TrackDeFi y On-Chain
import { fetchOnChainPools } from './onchainpools.js';

// Exportaciones requeridas por el sistema principal
export let poolItems = [];
export let rawResults = [];

export function parsePositions(rawData, walletConfig) {
  return [];
}

export async function loadPools() {
  try {
    const res = await fetchOnChainPools();
    if (res && res.positions) {
      poolItems = res.positions;
      rawResults = res.raws || [];
      return res;
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

export const fetchPools = loadPools;
