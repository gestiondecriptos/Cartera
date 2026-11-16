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
  tron: ['TPR5czP8415hYSBoc8bQ1zYctXLbcfBX31'],
  cosmos: ['cosmos1h2zm4974mmg74839p3syukpz4cxl00v030g6mw'],
};

// Pestaña 6: activos permitidos
export const DUAL_ASSETS = ['BTCB', 'ETH', 'BNB', 'USDT'];
export const CEX_ASSETS = ['BTC', 'ETH', 'BNB', 'USDC', 'USDT', 'EUR', 'NEXO', 'OKB'];

// Tokens envueltos que se suman a su activo real en el total global
export const UNDERLYING = {
  WETH: 'ETH', WBNB: 'BNB', BTCB: 'BTC', WBTC: 'BTC', cbBTC: 'BTC', CBBTC: 'BTC',
  sPENDLE: 'PENDLE', SPENDLE: 'PENDLE',
  USDCn: 'USDC', USDCN: 'USDC', USDbC: 'USDC', USDBC: 'USDC', 'USDC.e': 'USDC',
  USDT0: 'USDT', usdt0: 'USDT',
};

// Tokens de staking líquido que se muestran como su activo base (cantidad equivalente = valor ÷ precio del activo base)
export const LIQUID_STAKING = { PSOL: 'SOL', wstETH: 'ETH', WSTETH: 'ETH' };

// Pools que NO forman parte de la cartera (por nombre exacto del par en TrackDeFi)
export const IGNORE_POOLS = ['8LNDS/USDC'];

// Tokens de recibo de staking que se cuentan en la categoría «staking»
export const STAKING_SYMBOLS = ['SPENDLE', 'WSTETH'];

// Símbolo -> id de CoinGecko (comprobar si alguno deja de devolver precio)
export const COINGECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana', LINK: 'chainlink',
  SKY: 'sky', AAVE: 'aave', NEXO: 'nexo', OKB: 'okb', TRX: 'tron', HYPE: 'hyperliquid',
  ATOM: 'cosmos', USDC: 'usd-coin', USDT: 'tether', SYRUP: 'syrup', PENDLE: 'pendle',
  CAKE: 'pancakeswap-token', WBTC: 'wrapped-bitcoin', BTCB: 'binance-bitcoin',
  cbBTC: 'coinbase-wrapped-btc', wstETH: 'wrapped-steth', XAUT: 'tether-gold',
  EURC: 'euro-coin', PSOL: 'phantom-staked-sol', ARB: 'arbitrum',
};

// Posiciones de pools de liquidez (Uniswap, PancakeSwap, Aerodrome…) de cada dirección EVM
export const TRACKDEFI_URL = 'https://trackdefi.app/api/positions';

// Fuentes públicas gratuitas por red (se pueden cambiar si una cae)
export const CHAINS = {
  evm: [
    // moralis: nombre de la red en Moralis (respaldo si hay clave) · prefer: 'moralis' lo usa primero
    { name: 'Ethereum', native: 'ETH', api: 'https://eth.blockscout.com', moralis: 'eth' },
    { name: 'Base', native: 'ETH', api: 'https://base.blockscout.com', moralis: 'base', prefer: 'moralis' },
    { name: 'Arbitrum', native: 'ETH', api: 'https://arbitrum.blockscout.com', moralis: 'arbitrum' },
    { name: 'Unichain', native: 'ETH', api: 'https://unichain.blockscout.com' },
  ],
  hyperliquid: 'https://api.hyperliquid.xyz/info',
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
      '0x56a7ddc4e848EbF43845854205ad71D5D5F72d3D': 'aBnbBTCB',
      '0x9b00a09492a626678e5a3009982191586c444df9': 'aBnbWBNB',
      '0xa9251ca9de909cb71783723713b21e4233fbf1b1': 'aBnbUSDT',
      '0xf8bb2be50647447fb355e3a77b81be4db64107cd': 'variableDebtBnbUSDT',
      '0x0e76414d433ddfe8004d2a7505d218874875a996': 'variableDebtBnbWBNB',
      '0x7b1e82f4f542fbb25d64c5523fe3e44abe4f2702': 'variableDebtBnbBTCB',
    },
  },
  tronApi: 'https://api.trongrid.io',
  tronTokens: { TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t: { symbol: 'USDT', decimals: 6 } },
  cosmosRest: ['https://cosmos-rest.publicnode.com', 'https://rest.cosmos.directory/cosmoshub'],
};

// APR de staking leído de DefiLlama. Para cada token se prueban las reglas en orden y se usa el pool con más TVL que cumpla:
// project (contiene), symbol (igual), chain (igual). «approx» marca un pool parecido usado como referencia.
// Si ninguna regla encuentra pool, se muestra un APR de ejemplo.
export const APR_SOURCES = {
  SKY: [{ project: 'sky-lending', symbol: 'SKY', chain: 'Ethereum' }, { project: 'sky', symbol: 'SKY', chain: 'Ethereum' }],
  HYPE: [{ project: 'kinetiq', chain: 'Hyperliquid L1', approx: true }],
  ATOM: [{ project: 'stride', symbol: 'ATOM', approx: true }],
  PENDLE: [{ project: 'pendle', symbol: 'SPENDLE' }],
};

// APR por defecto (%) cuando DefiLlama no da uno para ese token. Puedes cambiarlos aquí.
export const STAKING_APR_DEFAULT = { SKY: 4.7, TRX: 3.3, HYPE: 2.2, ATOM: 14, PENDLE: 1.5, SOL: 5.5 };

// Claves de API (opcionales): pégalas entre las comillas.
// ATENCIÓN: este archivo es público en GitHub, así que cualquiera podría ver y usar tus claves. Usa planes gratuitos y, si las ves usadas por otros, genera claves nuevas.
export const API_KEYS = {
  MORALIS_API_KEY: '',  // EVM: Base, Ethereum y Arbitrum (https://admin.moralis.com)
};
