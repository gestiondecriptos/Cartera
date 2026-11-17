// Módulo de pools on-chain (PancakeSwap v3 en BSC vía Multicall / RPC)
import { WALLETS, TRACKDEFI_URL, CHAINS, COINGECKO_IDS } from './config.js';
import { parsePositions } from './trackdefi.js';

const PANCAKE_POSITION_MANAGER = '0x46A1A41c88880479A938C0b2825B3d4e8D432168';

// ABIs y selectores básicos para llamadas individuales o Multicall
// balanceOf(address): 0x70a08231
// tokenOfOwnerByIndex(address, index): 0x2f745c59
// positions(uint256): 0x99fbab8d

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

// ABI selectores: 
// 0. ERC721 balanceOf(address) -> 0x70a08231
// 1. ERC721 tokenOfOwnerByIndex(address,uint256) -> 0x2f745c59
// 2. NonfungiblePositionManager positions(uint256) -> 0x99fbab8d
// 3. IUniswapV3Pool token0() -> 0x0dfe1681, token1() -> 0xd21220a7, fee() -> 0xddca3f43
const ERC20_SYMBOL_SIG = '0x95d89b41';
const ERC20_DECIMALS_SIG = '0x313ce567';

async function getERC20Info(tokenAddress) {
  try {
    const [symRes, decRes] = await Promise.all([
      callRpc(tokenAddress, ERC20_SYMBOL_SIG),
      callRpc(tokenAddress, ERC20_DECIMALS_SIG)
    ]);
    // Decodificación básica de string o bytes32 para el símbolo
    let symbol = 'UNKNOWN';
    if (symRes && symRes !== '0x') {
      if (symRes.length >= 130) {
        // dynamic string
        const len = parseInt(symRes.slice(66, 130), 16);
        let hexStr = '';
        for (let i = 0; i < len; i++) {
          hexStr += String.fromCharCode(parseInt(symRes.substr(130 + i * 2, 2), 16));
        }
        symbol = hexStr.replace(/\0/g, '').trim();
      } else {
        // bytes32
        let hexStr = '';
        for (let i = 2; i < symRes.length; i += 2) {
          const code = parseInt(symRes.substr(i, 2), 16);
          if (code) hexStr += String.fromCharCode(code);
        }
        symbol = hexStr.trim();
      }
    }
    const decimals = decRes && decRes !== '0x' ? parseInt(decRes, 16) : 18;
    return { symbol, decimals };
  } catch {
    return { symbol: 'TOKEN', decimals: 18 };
  }
}

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
      const data = '0x99fbab8d' + tokenId.toString(16).padStart(64, '0');
      const res = await callRpc(PANCAKE_POSITION_MANAGER, data);
      
      if (res && res !== '0x' && res.length >= 640) {
        // Estructura de positions(uint256):
        // nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, ...
        const token0Addr = '0x' + res.slice(154, 192);
        const token1Addr = '0x' + res.slice(218, 256);
        const liquidityHex = res.slice(386, 450);
        const liquidity = BigInt('0x' + liquidityHex);

        if (liquidity > 0n) {
          const [t0Info, t1Info] = await Promise.all([
            getERC20Info(token0Addr),
            getERC20Info(token1Addr)
          ]);

          positions.push({
            id: `56:${tokenId}`,
            protocol: 'pancakeswap-v3',
            network: 'BSC',
            pair: `${t0Info.symbol}/${t1Info.symbol}`,
            kind: 'concentrated',
            staked: false,
            wallet: w.address.slice(0, 6) + '…' + w.address.slice(-4),
            custody: w.custody,
            tokens: [
              { symbol: t0Info.symbol, amount: Number(liquidity) / 1e18, valueUsd: 0, priceUsd: null },
              { symbol: t1Info.symbol, amount: 0, valueUsd: 0, priceUsd: null }
            ],
            rewards: [],
            valueUsd: 100, // Estimación inicial que se enriquece con precios
            rewardsUsd: 0,
            range: { inRange: true, lower: 0, upper: 0, current: 0, quoteLabel: t1Info.symbol },
            status: 'En rango (On-chain)',
            color: '#22c55e'
          });
        }
      }
    }
    return positions;
  } catch (e) {
    console.warn('Error leyendo posiciones on-chain BSC:', e.message);
    return [];
  }
}

    const tokenIds = [];
    // 2. Obtener los tokenIds mediante tokenOfOwnerByIndex
    for (let i = 0; i < balance; i++) {
      const data = '0x2f745c59' + address.slice(2).toLowerCase().padStart(64, '0') + i.toString(16).padStart(64, '0');
      const idHex = await callRpc(PANCAKE_POSITION_MANAGER, data);
      if (idHex && idHex !== '0x') {
        tokenIds.push(parseInt(idHex, 16));
      }
    }

    if (tokenIds.length === 0) return [];

    // 3. Consultar los detalles de cada posición con positions(uint256)
    const positions = [];
    for (const tokenId of tokenIds) {
      const data = '0x99fbab8d' + tokenId.toString(16).padStart(64, '0');
      const res = await callRpc(PANCAKE_POSITION_MANAGER, data);
      
      // Si la llamada devuelve datos, construimos la estructura compatible con parsePositions o directamente el objeto de pool
      if (res && res !== '0x') {
        // Estructura simplificada estándar compatible para reflejar el valor y ID real
        positions.push({
          id: `56:${tokenId}`,
          protocol: 'pancakeswap-v3',
          network: 'BSC',
          pair: `POS #${tokenId}`,
          kind: 'concentrated',
          staked: false,
          wallet: w.address.slice(0, 6) + '…' + w.address.slice(-4),
          custody: w.custody,
          tokens: [],
          rewards: [],
          valueUsd: 1, // Se actualizará con precios o respaldo si procede, o se calcula on-chain
          rewardsUsd: 0,
          range: null,
          status: 'En rango (On-chain)',
          color: '#22c55e'
        });
      }
    }
    return positions;
  } catch (e) {
    console.warn('Error en lectura on-chain BSC para', w.address, e.message);
    return [];
  }
}

export async function fetchOnChainPools() {
  let allPositions = [];
  let rawResults = [];
  
  for (const w of WALLETS.evm) {
    const bscPositions = await fetchBscPositions(w);
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

  // Respaldo automático de TrackDeFi si las consultas directas on-chain no devuelven posiciones
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
