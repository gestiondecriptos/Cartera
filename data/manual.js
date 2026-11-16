// ===== DATOS MANUALES =====
// Se edita en GitHub (lápiz → cambiar → Commit changes) y se ve igual en todos tus dispositivos.
// REGLAS: cada línea termina en coma · los textos van entre comillas simples '...' · los decimales con punto (0.5, no 0,5)
// · las líneas que empiezan por // son comentarios (se pueden borrar o activar quitando el //).
// Si te equivocas, la web muestra un aviso rojo con el error.
export const MANUAL = {
  // 1) Fondos en exchanges: cantidad de cada activo (EUR en euros)
  cex: { BTC: 0.03881092, ETH: 0, BNB: 4.00949375, USDC: 514.14, USDT: 0, EUR: 0, NEXO: 243.68, OKB: 2.19 },

  // 2) Dual Investment (red BSC): cantidad de cada activo y deuda en USDT
  dual: { BTCB: 0.00294928, ETH: 0.044532, BNB: 0, USDT: 0 },
  dualDebtUSDT: 0,

  // 3) SKY en staking (cantidad)
  skyStaking: 2979.08,

  // 4) Participaciones del fondo: base inicial y una línea por cada ampliación (add) o reducción (sub)
  shares: {
    base: 181,
    movements: [
      // { date: '2026-12-01', type: 'add', qty: 10, price: 250 },
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
};
