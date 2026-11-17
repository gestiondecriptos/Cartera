// Módulo de integración principal para las pools (vía On-Chain con respaldo seguro)
import { fetchOnChainPools } from './onchainpools.js';

export function parsePositions(rawData, walletConfig) {
  return [];
}

export async function loadPools() {
  try {
    const onChainResult = await fetchOnChainPools();
    if (onChainResult && onChainResult.positions && onChainResult.positions.length > 0) {
      return onChainResult;
    }
  } catch (e) {
    console.warn('Error procesando pools:', e);
  }
  
  // Retorno estructurado vacío para evitar errores de renderizado en la interfaz
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
