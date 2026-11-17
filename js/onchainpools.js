// Módulo de pools on-chain (Uniswap v3 / PancakeSwap v3)
import { WALLETS, TRACKDEFI_URL, CHAINS } from './config.js';
import { parsePositions } from './trackdefi.js';

const PANCAKE_POSITION_MANAGER = '0x46A1A41c88880479A938C0b2825B3d4e8D432168';

async function fetchBscPositions(address) {
  try {
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [
        {
          to: PANCAKE_POSITION_MANAGER,
          data: '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0')
        },
        'latest'
      ]
    };
    const r = await fetch(CHAINS.bsc.rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000)
    });
    const j = await r.json();
    const balance = j.result ? parseInt(j.result, 16) : 0;
    if (balance > 0) {
      console.log(`Dirección ${address} tiene ${balance} posiciones en PancakeSwap v3 BSC`);
    }
  } catch (e) {
    console.warn('Error leyendo posiciones on-chain BSC:', e.message);
  }
  return [];
}

export async function fetchOnChainPools() {
  let allPositions = [];
  let rawResults = [];
  
  for (const w of WALLETS.evm) {
    const bscPositions = await fetchBscPositions(w.address);
    if (bscPositions.length > 0) {
      allPositions.push(...bscPositions);
    }
  }

  if (allPositions.length > 0) {
    return { 
      positions: allPositions, 
      source: 'live', 
      raws: rawResults, 
      failed: [], 
      errs: [], 
      fetchedAt: new Date().toISOString(), 
      warnings: [] 
    };
  }

  // Respaldo automático de TrackDeFi si no hay posiciones on-chain todavía
  try {
    const results = [];
    for (const w of WALLETS.evm) {
      const r = await fetch(`${TRACKDEFI_URL}?address=${w.address}`, { signal: AbortSignal.timeout(20000) });
      if (r.ok) {
        results.push({ address: w.address, data: await r.json() });
      }
    }
    const positions = results.flatMap(({ address, data }) => 
      parsePositions(data, WALLETS.evm.find(w => w.address === address) || { address, custody: 'ledger' })
    );
    if (positions.length > 0) {
      return { positions, source: 'live', raws: results, failed: [], errs: [], fetchedAt: new Date().toISOString(), warnings: [] };
    }
  } catch (e) {
    console.warn('Respaldo de TrackDeFi falló:', e.message);
  }
  
  return null;
}
