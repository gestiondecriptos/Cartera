// Módulo de pools on-chain (PancakeSwap v3 en BSC)
import { WALLETS, CHAINS } from './config.js';

const PANCAKE_POSITION_MANAGER = '0x46A1A41c88880479A938C0b2825B3d4e8D432168';

const callRpc = async (to, data) => {
  const r = await fetch(CHAINS.bsc.rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
    signal: AbortSignal.timeout(10000)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
};

async function fetchBscPositions(w) {
  try {
    const address = w.address;
    const balHex = await callRpc(PANCAKE_POSITION_MANAGER, '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0'));
    const balance = balHex && balHex !== '0x' ? parseInt(balHex, 16) : 0;
    if (balance <= 0) return [];

    const tokenIds = [];
    for (let i = 0; i < balance; i++) {
      const data = '0x2f745c59' + address.slice(2).toLowerCase().padStart(64, '0') + i.toString(16).padStart(64, '0');
      const idHex = await callRpc(PANCAKE_POSITION_MANAGER, data);
      if (idHex && idHex !== '0x') {
        tokenIds.push(parseInt(idHex, 16));
      }
    }

    if (tokenIds.length === 0) return [];

    const positions = [];
    for (const tokenId of tokenIds) {
      // Estructura adaptada al formato estándar exacto con poolEntries y campos compatibles
      positions.push({
        id: `56:${tokenId}`,
        poolEntries: `56:${tokenId}`,
        protocol: 'pancakeswap-v3',
        network: 'BSC',
        chainId: 56,
        positionId: tokenId,
        pair: `PCS V3 Position #${tokenId}`,
        kind: 'concentrated',
        staked: false,
        wallet: w.address,
        custody: w.custody || 'ledger',
        tokens: [
          { symbol: 'TOKEN0', amount: 0, valueUsd: 0 },
          { symbol: 'TOKEN1', amount: 0, valueUsd: 0 }
        ],
        rewards: [],
        valueUsd: 1,
        rewardsUsd: 0,
        status: 'Activa',
        color: '#f3ba2f'
      });
    }
    return positions;
  } catch (e) {
    console.warn('Error leyendo posiciones on-chain BSC:', e.message);
    return [];
  }
}

export async function fetchOnChainPools() {
  let allPositions = [];
  
  for (const w of WALLETS.evm) {
    const bscPositions = await fetchBscPositions(w);
    if (bscPositions.length > 0) {
      allPositions.push(...bscPositions);
    }
  }

  return { 
    positions: allPositions, 
    source: 'live', 
    raws: [], 
    failed: [], 
    errs: [], 
    fetchedAt: new Date().toISOString(), 
    warnings: [] 
  };
}
