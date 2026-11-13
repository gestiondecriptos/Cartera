// DATOS SIMULADOS (de ejemplo). Solo se usan si una API falla.
// Los importes NO son tuyos: sirven para ver cómo funciona el motor contable.
export const MOCK_EUR_USD = 1.08;

const USD = {
  BTC: 95000, ETH: 3300, BNB: 620, SOL: 180, LINK: 18, SKY: 0.06, AAVE: 230, NEXO: 1.2,
  OKB: 50, TRX: 0.25, HYPE: 28, ATOM: 6, USDC: 1, USDT: 1, SYRUP: 0.4, PENDLE: 4.5,
  CAKE: 2.5, WBTC: 95000, BTCB: 95000,
};

export const MOCK_PRICES = Object.fromEntries(
  Object.entries(USD).map(([s, usd]) => [s, { usd, eur: usd / MOCK_EUR_USD }])
);

export const MOCK_BTC_ONCHAIN = [
  { symbol: 'BTC', amount: 0.5, network: 'Bitcoin', wallet: 'bc1qk3r…a2t0', custody: 'ledger' },
  { symbol: 'BTC', amount: 0.3, network: 'Bitcoin', wallet: 'bc1q9c9…z0gv', custody: 'ledger' },
  { symbol: 'BTC', amount: 0.2, network: 'Bitcoin', wallet: 'bc1qvd9…ssev', custody: 'ledger' },
];

export const MOCK_OTHER_ONCHAIN = [
  { symbol: 'ETH', amount: 3.2, network: 'Ethereum', wallet: '0xB939…86f2', custody: 'ledger' },
  { symbol: 'aEthWETH', amount: 5, network: 'Ethereum', wallet: '0xB939…86f2', custody: 'ledger' },
  { symbol: 'aLINK', amount: 800, network: 'Ethereum', wallet: '0xB939…86f2', custody: 'ledger' },
  { symbol: 'aAAVE', amount: 20, network: 'Ethereum', wallet: '0xB939…86f2', custody: 'ledger' },
  { symbol: 'variableDebtEthUSDC', amount: 15000, network: 'Ethereum', wallet: '0xB939…86f2', custody: 'ledger' },
  { symbol: 'USDC', amount: 2000, network: 'Base', wallet: '0x34bC…890f', custody: 'metamask' },
  { symbol: 'HYPE', amount: 150, network: 'Hyperliquid', wallet: '0x34bC…890f', custody: 'metamask', category: 'staking' },
  { symbol: 'SOL', amount: 40, network: 'Solana', wallet: '4gaS…zR12', custody: 'phantom' },
  { symbol: 'TRX', amount: 20000, network: 'Tron', wallet: 'TPR5…X31', custody: 'ledger', category: 'staking' },
  { symbol: 'SKY', amount: 10000, network: 'Ethereum', wallet: '0xB939…86f2', custody: 'ledger', category: 'staking' },
  { symbol: 'PENDLE', amount: 1000, network: 'Ethereum', wallet: '0xB939…86f2', custody: 'ledger', category: 'staking' },
  { symbol: 'ATOM', amount: 500, network: 'Cosmos', wallet: 'cosmos1h2…6mw', custody: 'ledger', category: 'staking' },
];

// APR de staking de ejemplo (%). Fase 3: sustituir por datos reales.
export const MOCK_STAKING_APR = { SKY: 6.5, TRX: 4.5, HYPE: 2.2, ATOM: 15, PENDLE: 10 };

// Pools de liquidez de EJEMPLO (TrackDeFi se conectará más adelante).
// base/quote: el precio del par = precio(base) / precio(quote). IL, ROI y días son de ejemplo.
export const MOCK_POOLS = [
  { pair: 'ETH/USDC', protocol: 'Uniswap v3', network: 'Ethereum', base: 'ETH', quote: 'USDC', min: 2800, max: 3800, amounts: { ETH: 1.2, USDC: 1800 }, invested: 5600, ilUsd: -85, roiUsd: 210, days: 42 },
  { pair: 'WBTC/USDC', protocol: 'Uniswap v3', network: 'Base', base: 'WBTC', quote: 'USDC', min: 70000, max: 90000, amounts: { WBTC: 0, USDC: 9000 }, invested: 8500, ilUsd: -420, roiUsd: 310, days: 75 },
  { pair: 'BNB/USDT', protocol: 'PancakeSwap v3', network: 'BSC', base: 'BNB', quote: 'USDT', min: 560, max: 650, amounts: { BNB: 4, USDT: 1500 }, invested: 3900, ilUsd: -40, roiUsd: 95, days: 20 },
];
