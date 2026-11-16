// Genera el texto de data/manual.js (plantilla vacía o con los datos que se le pasen)
import { CEX_ASSETS, DUAL_ASSETS } from './config.js';

const n = v => (Number.isFinite(+v) ? +v : 0);

export function manualFileText(m = {}) {
  const cex = CEX_ASSETS.map(a => `${a}: ${n(m.cex?.[a])}`).join(', ');
  const dualAmt = Object.fromEntries((m.dual || []).map(p => [p.asset, p.amount]));
  const dual = DUAL_ASSETS.map(a => `${a}: ${n(dualAmt[a])}`).join(', ');
  const mov = (m.shares?.movements || []).map(x => `      { date: '${String(x.date).slice(0, 10)}', type: '${x.type === 'sub' ? 'sub' : 'add'}', qty: ${n(x.qty)}, price: ${n(x.price)} },`).join('\n');
  const dca = (m.dca || []).map(r => `    { month: '${r.month}', buyUsd: ${n(r.buyUsd)}, debt: ${n(r.debt)}, ltv: ${n(r.ltv)}, btc: ${n(r.btc)} },`).join('\n');
  const pe = Object.entries(m.poolEntries || {}).map(([id, e]) => `    '${id}': { date: '${e.date}', invested: ${n(e.invested)}, a0: ${n(e.a0)}, a1: ${n(e.a1)} },`).join('\n');
  return `// ===== DATOS MANUALES =====
// Se edita en GitHub (lápiz → cambiar → Commit changes) y se ve igual en todos tus dispositivos.
// REGLAS: cada línea termina en coma · los textos van entre comillas simples '...' · los decimales con punto (0.5, no 0,5)
// · las líneas que empiezan por // son comentarios (se pueden borrar o activar quitando el //).
// Si te equivocas, la web muestra un aviso rojo con el error.
export const MANUAL = {
  // 1) Fondos en exchanges: cantidad de cada activo (EUR en euros)
  cex: { ${cex} },

  // 2) Dual Investment (red BSC): cantidad de cada activo y deuda en USDT
  dual: { ${dual} },
  dualDebtUSDT: ${n(m.dualDebt)},

  // 3) SKY en staking (cantidad)
  skyStaking: ${n(m.stakingManual?.SKY)},

  // 4) Participaciones del fondo: base inicial y una línea por cada ampliación (add) o reducción (sub)
  shares: {
    base: ${m.shares?.base != null ? n(m.shares.base) : 181},
    movements: [
${mov || "      // { date: '2026-12-01', type: 'add', qty: 10, price: 250 },"}
    ],
  },

  // 5) Estrategia DCA con BTC como colateral: una línea por compra. La ÚLTIMA línea es la que cuenta
  //    para la deuda del patrimonio (el BTC se lee solo de aBnbBTCB en BSC).
  dca: [
${dca || "    // { month: '2026-06', buyUsd: 100, debt: 50, ltv: 10, btc: 0.1 },"}
  ],

  // 6) Entradas de pools (para IL, tiempo y ROI). La clave es el «id» que aparece bajo cada pool en la pestaña Pools.
  //    a0 y a1 = cantidad inicial de cada token (opcional: 0 si no la sabes; sin ellas no se calcula el IL).
  poolEntries: {
${pe || "    // '56:7487589': { date: '2026-09-26', invested: 30, a0: 15, a1: 0.012 },"}
  },
};
`;
}
