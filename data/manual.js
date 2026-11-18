// ===== DATOS MANUALES =====
// Se edita en GitHub (lápiz → cambiar → Commit changes) y se ve igual en todos tus dispositivos.
// REGLAS: cada línea termina en coma · los textos van entre comillas simples '...' · los decimales con punto (0.5, no 0,5)
// · las líneas que empiezan por // son comentarios (se pueden borrar o activar quitando el //).
// Si te equivocas, la web muestra un aviso rojo con el error.
export const MANUAL = {
  // 1) Fondos en exchanges: cantidad de cada activo (EUR en euros)
  cex: { BTC: 0.03881092, ETH: 0, BNB: 4.00949375, USDC: 514.14, USDT: 0, EUR: 0, NEXO: 243.68, OKB: 2.19 },

  // 2) Dual Investment (red BSC): cantidad de cada activo y deuda en USDT
  dualLedger: { BTCB: 0.001, ETH: 0, BNB: 0, USDT: 76.70 },
  dualDebtLedger: 0,
  dualBnb: { BTCB: 0.00296628, ETH: 0.04445563, BNB: 0, USDT: 0 },
  dualDebtBnb: 0,

  // 3) SKY en staking (cantidad)
  skyStaking: 2979.08,
  psolStaking: 2.71925,

  // 4) Participaciones del fondo: base inicial y una línea por cada ampliación (add) o reducción (sub)
  shares: {
    base: 0,
    movements: [
      { date: '2017-12-21', type: 'add', qty: 5, price: 10 },
      { date: '2017-12-23', type: 'add', qty: 10, price: 10 },
      { date: '2018-01-04', type: 'add', qty: 5, price: 10 },
      { date: '2018-01-11', type: 'add', qty: 10, price: 10 },
      { date: '2018-04-13', type: 'add', qty: 5, price: 5 },
      { date: '2018-04-13', type: 'add', qty: 5, price: 5 },
      { date: '2018-04-14', type: 'add', qty: 5, price: 5 },
      { date: '2018-05-14', type: 'add', qty: 10, price: 6.40 },
      { date: '2018-05-14', type: 'add', qty: 10, price: 6.40 },
      { date: '2018-05-14', type: 'add', qty: 10, price: 6.40 },
      { date: '2018-05-14', type: 'add', qty: 25, price: 6.40 },
      { date: '2020-08-10', type: 'sub', qty: 25, price: 5.00 },
      { date: '2020-08-10', type: 'add', qty: 25, price: 5.00 },
      { date: '2020-09-10', type: 'add', qty: 50, price: 5.00 },
      { date: '2020-11-13', type: 'add', qty: 25, price: 6.40 },
      { date: '2021-01-05', type: 'sub', qty: 25, price: 10.50 },
      { date: '2021-01-05', type: 'sub', qty: 25, price: 10.50 },
      { date: '2021-01-05', type: 'add', qty: 25, price: 10.50 },
      { date: '2021-01-08', type: 'add', qty: 10, price: 12.00 },
      { date: '2021-01-25', type: 'add', qty: 5, price: 11.20 },
      { date: '2021-03-25', type: 'add', qty: 4, price: 25.00 },
      { date: '2021-04-09', type: 'sub', qty: 4, price: 34.00 },
      { date: '2021-05-02', type: 'sub', qty: 3, price: 40.00 },
      { date: '2021-07-01', type: 'sub', qty: 10, price: 25.00 },
      { date: '2021-07-04', type: 'sub', qty: 6, price: 24.50 },
      { date: '2021-07-27', type: 'sub', qty: 26, price: 23.44 },
      { date: '2021-07-27', type: 'add', qty: 9, price: 29.40 },
      { date: '2021-09-15', type: 'sub', qty: 2, price: 24.00 },
      { date: '2021-10-17', type: 'add', qty: 3, price: 33.10 },
      { date: '2021-12-23', type: 'add', qty: 6, price: 40.00 },
      { date: '2021-12-24', type: 'add', qty: 1, price: 48.00 },
      { date: '2022-01-01', type: 'add', qty: 2, price: 45.00 },
      { date: '2022-04-06', type: 'add', qty: 5, price: 42.00 },
      { date: '2022-06-07', type: 'add', qty: 4, price: 25.00 },
      { date: '2022-07-26', type: 'add', qty: 4, price: 23.50 },
      { date: '2022-09-01', type: 'add', qty: 2, price: 23.00 },
      { date: '2022-09-25', type: 'add', qty: 5, price: 23.00 },
      { date: '2022-10-17', type: 'sub', qty: 1, price: 22.90 },
      { date: '2022-10-31', type: 'add', qty: 2, price: 25.00 },
      { date: '2023-01-06', type: 'add', qty: 6, price: 19.00 },
      { date: '2023-03-13', type: 'add', qty: 4, price: 24.00 },
      { date: '2023-03-20', type: 'add', qty: 2, price: 27.00 },
      { date: '2023-04-15', type: 'add', qty: 2, price: 29.00 },
      { date: '2023-06-06', type: 'add', qty: 4, price: 25.75 },
      { date: '2023-08-02', type: 'add', qty: 4, price: 25.25 },
      { date: '2023-09-05', type: 'add', qty: 2, price: 22.50 },
      { date: '2023-10-13', type: 'add', qty: 5, price: 23.50 },
      { date: '2023-12-24', type: 'add', qty: 9, price: 36.00 },
      { date: '2024-03-14', type: 'sub', qty: 5, price: 66.00 },
      { date: '2024-05-20', type: 'sub', qty: 6, price: 58.00 },
      { date: '2024-09-20', type: 'sub', qty: 2, price: 52.25 },
      { date: '2024-11-17', type: 'sub', qty: 10, price: 71.00 },
      { date: '2024-11-28', type: 'sub', qty: 6, price: 77.70 },
      { date: '2024-12-17', type: 'sub', qty: 3, price: 87.30 },
      { date: '2026-06-05', type: 'add', qty: 8, price: 50.00 },
      { date: '2026-09-26', type: 'add', qty: 3, price: 71.50 },
      { date: '2026-10-16', type: 'add', qty: 4, price: 69.10 },
      { date: '2026-11-17', type: 'add', qty: 8, price: 54.00 },
    ],
  },
  // 5) Estrategia DCA con BTC como colateral: una línea por compra. La ÚLTIMA línea es la que cuenta
  //    para la deuda del patrimonio (el BTC se lee solo de aBnbBTCB en BSC).
  dca: [
    { month: '2026-06', buyUsd: 1080.77, debt: 0, ltv: 0, btc: 0.0174318 },
    { month: '2026-07', buyUsd: 59.64, debt: 59.64, ltv: 5, btc: 0.0184318 },
    { month: '2026-08', buyUsd: 77.79, debt: 137.43, ltv: 12, btc: 0.0194318 },
    { month: '2026-09', buyUsd: 77, debt: 214.43, ltv: 19, btc: 0.0204318 },
    { month: '2026-10', buyUsd: 82.92, debt: 297.35, ltv: 27, btc: 0.0214318 },
    { month: '2026-10', buyUsd: 80, debt: 377.35, ltv: 35, btc: 0.0224318 },
    { month: '2026-11', buyUsd: 76.70, debt: 454.05, ltv: 43, btc: 0.02343180 },
    { month: '2026-11', buyUsd: 73.30, debt: 527.35, ltv: 50, btc: 0.02443180 },
    { month: '2026-11', buyUsd: 68.50, debt: 595.85, ltv: 57, btc: 0.02543180 },
    { month: '2026-11', buyUsd: 64.27, debt: 660.12, ltv: 63, btc: 0.02643180 },
  ],
  // 7) Activos manuales en otras redes o sitios (p. ej. Base): una línea por activo.
  //    custody: 'ledger' | 'metamask' | 'phantom' | 'exchange'. Para una deuda usa el prefijo variableDebt (ej. 'variableDebtUSDC').
  manualAssets: [
   { network: 'Base', symbol: 'USDC', amount: 0, custody: 'metamask' },
   { network: 'Base', symbol: 'ETH', amount: 0.00091, custody: 'metamask' },
  ],
  // 6) Entradas de pools (para IL, tiempo y ROI). La clave es el «id» que aparece bajo cada pool en la pestaña Pools.
  //    a0 y a1 = cantidad inicial de cada token (opcional: 0 si no la sabes; sin ellas no se calcula el IL).
  poolEntries: {
    '56:7609656': { date: '2026-10-02', invested: 77.36, a0: 0.1, a1: 0 },
    '56:7609363': { date: '2026-10-02', invested: 77.36, a0: 0.1, a1: 0 },
    '56:7790577': { date: '2026-11-11', invested: 39.69, a0: 0.002622, a1: 0.05 },
    '56:7790596': { date: '2026-11-11', invested: 34.39, a0: 0.13, a1: 0.05 },
    '56:7535666': { date: '2026-09-22', invested: 41, a0: 10, a1: 16 },
    '56:7487589': { date: '2026-08-19', invested: 38.42, a0: 0, a1: 0.050334 },
  },
}
