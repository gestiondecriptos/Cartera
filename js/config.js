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
export const UNDERLYING = { WETH: 'ETH', WBNB: 'BNB', BTCB: 'BTC', WBTC: 'BTC' };

// Símbolo -> id de CoinGecko (comprobar si alguno deja de devolver precio)
export const COINGECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana', LINK: 'chainlink',
  SKY: 'sky', AAVE: 'aave', NEXO: 'nexo', OKB: 'okb', TRX: 'tron', HYPE: 'hyperliquid',
  ATOM: 'cosmos', USDC: 'usd-coin', USDT: 'tether', SYRUP: 'syrup', PENDLE: 'pendle',
  CAKE: 'pancakeswap-token', WBTC: 'wrapped-bitcoin', BTCB: 'binance-bitcoin',
};
