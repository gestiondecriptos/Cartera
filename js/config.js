// Configuración central. Aquí se cambian wallets, activos permitidos y constantes.
export const STORAGE_KEY = 'cripto-dashboard:v1';
export const INITIAL_SHARES = 181;

export const WALLETS = {
  btc: [
    'bc1qk3rvctt64qzvhztxjkmc39rme6me4jklhpa2t0',
    'bc1q9c9zv6pf4f3gtg3rd4nhdvw5ea5gl6yzztz0gv',
    'bc1qvd9ct07qwdcvshcgscplxm68q6aa5lrzdrssev',
  ],
  evm: [
    { address: '0xB9394692294C000d88d3Bc131c6Bef7B1f9286f2', custody: 'ledger' },
    { address: '0x34bC9ceBA589CDBD67bC26932a334cC6c263890f', custody: 'metamask' },
  ],
  solana: ['4gaSGp9FuujptfscRtEcD63xgi2XWQ7dbhBuPLzFzR12'],
  tron: ['TPR5czP8415hYSBoc8bQ1zYctXLbcfBX31'],
  cosmos: ['cosmos1h2zm4974mmg74839p3syukpz4cxl00v030g6mw'],
};

// Pestaña 6: activos permitidos
export const DUAL_ASSETS = ['BTCB', 'ETH', 'BNB', 'USDT'];
export const CEX_ASSETS = ['BTC', 'ETH', 'BNB', 'USDC', 'USDT', 'EUR', 'NEXO', 'OKB'];

// Tokens envueltos que se suman a su activo real en el total global
export const UNDERLYING = { WETH: 'ETH', WBNB: 'BNB', BTCB: 'BTC', WBTC: 'BTC', sPENDLE: 'PENDLE', SPENDLE: 'PENDLE' }; // sPENDLE = PENDLE en staking, 1:1

// Tokens de recibo de staking que se cuentan en la categoría «staking»
export const STAKING_SYMBOLS = ['SPENDLE'];

// Símbolo -> id de CoinGecko (comprobar si alguno deja de devolver precio)
export const COINGECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana', LINK: 'chainlink',
  SKY: 'sky', AAVE: 'aave', NEXO: 'nexo', OKB: 'okb', TRX: 'tron', HYPE: 'hyperliquid',
  ATOM: 'cosmos', USDC: 'usd-coin', USDT: 'tether', SYRUP: 'syrup', PENDLE: 'pendle',
  CAKE: 'pancakeswap-token', WBTC: 'wrapped-bitcoin', BTCB: 'binance-bitcoin',
  JITOSOL: 'jito-staked-sol', MSOL: 'msol', JUP: 'jupiter-exchange-solana', PSOL: 'phantom-staked-sol',
};

// Posiciones de pools de liquidez (Uniswap, PancakeSwap, Aerodrome…) de cada dirección EVM
export const TRACKDEFI_URL = 'https://trackdefi.app/api/positions';

// Fuentes públicas gratuitas por red (se pueden cambiar si una cae)
export const CHAINS = {
  evm: [
    { name: 'Ethereum', native: 'ETH', api: 'https://eth.blockscout.com' },
    { name: 'Base', native: 'ETH', api: 'https://base.blockscout.com' },
    { name: 'Optimism', native: 'ETH', api: 'https://optimism.blockscout.com' },
    { name: 'Arbitrum', native: 'ETH', api: 'https://arbitrum.blockscout.com' },
  ],
  hyperliquid: 'https://api.hyperliquid.xyz/info',
  solanaRpc: 'https://solana-rpc.publicnode.com',
  // mint de cada token SPL que quieres reconocer (los demás se ignoran)
  solanaMints: {
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC' },
    Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT' },
    pSo1f9nQXWgXibFtKf7NWYxb5enAM4qfP6UJSiXRQfL: { symbol: 'PSOL', category: 'staking' },      // SOL en staking con Phantom
    J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: { symbol: 'JITOSOL', category: 'staking' },
    mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: { symbol: 'MSOL', category: 'staking' },
    JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: { symbol: 'JUP' },
  },
  // BSC (sin clave): RPC público de PublicNode + tokens BEP-20 a reconocer (todos con 18 decimales)
  bsc: {
    rpc: 'https://bsc-rpc.publicnode.com', native: 'BNB',
    tokens: {
      '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c': 'BTCB',
      '0x55d398326f99059fF775485246999027B3197955': 'USDT',
      '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d': 'USDC',
      '0x2170Ed0880ac9A755fd29B2688956BD959F933F8': 'ETH',
      '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82': 'CAKE',
      '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c': 'WBNB',
    },
  },
  tronApi: 'https://api.trongrid.io',
  tronTokens: { TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t: { symbol: 'USDT', decimals: 6 } },
  cosmosRest: ['https://cosmos-rest.publicnode.com', 'https://rest.cosmos.directory/cosmoshub'],
};
