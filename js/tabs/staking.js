import { usd, qty, pct } from '../format.js';
import { STAKING_APR_DEFAULT } from '../config.js';

const TOKENS = ['SKY', 'TRX', 'HYPE', 'ATOM', 'PENDLE', 'SOL'];

// APR: DefiLlama si hay pool; si no, el valor por defecto de js/config.js
const aprFor = (sym, live) => live?.[sym] ? { apr: live[sym].apr, src: live[sym].label } : { apr: STAKING_APR_DEFAULT[sym] ?? 0, src: 'por defecto' };

export function stakingData({ view, market, aprLive }) {
  // los 5 tokens fijos + cualquier otro activo que tengas marcado como staking (PSOL…)
  const extra = view.holdings.filter(h => h.sources.some(s => s.category === 'staking')).map(h => h.symbol);
  const rows = [...new Set([...TOKENS, ...extra])].map(sym => {
    const h = view.holdings.find(x => x.symbol === sym);
    const amount = (h?.sources || []).filter(s => s.category === 'staking').reduce((t, s) => t + s.amount, 0);
    const value = amount * (market.prices[sym]?.usd ?? 0);
    const { apr, src } = aprFor(sym, aprLive);
    return { sym, amount, value, apr, src, daily: value * apr / 100 / 365 };
  });
  const tvl = rows.reduce((t, r) => t + r.value, 0);
  const wApr = tvl ? rows.reduce((t, r) => t + r.value * r.apr, 0) / tvl : 0;
  const daily = rows.reduce((t, r) => t + r.daily, 0);

  return { rows, tvl, wApr, daily };
}

export function render(ctx) {
  const { rows, tvl, wApr, daily } = stakingData(ctx);
  document.getElementById('staking-root').innerHTML = `
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="card"><div class="label">TVL en staking</div><div class="num text-2xl text-[#38bdf8]">${usd(tvl)}</div></div>
      <div class="card"><div class="label">APR medio ponderado</div><div class="num text-2xl text-[#22c55e]">${pct(wApr, 2)}</div></div>
      <div class="card"><div class="label">Generación diaria</div><div class="num text-2xl">${usd(daily)}</div></div>
    </div>
    <div class="card scroll-x"><table class="tbl">
      <thead><tr><th>Token</th><th class="r">Cantidad</th><th class="r">Valor (USD)</th><th class="r">APR</th><th class="r">Generación diaria</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td class="font-medium">${r.sym}</td><td class="num r">${qty(r.amount)}</td><td class="num r">${usd(r.value)}</td><td class="num r">${pct(r.apr, 2)} <span class="label">(${r.src})</span></td><td class="num r">${usd(r.daily)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="label mt-3">Saldos manuales de SKY y PSOL (Phantom), junto con el staking detectado en otras redes. PSOL se convierte a su equivalente en SOL. APR: de DefiLlama; y si no, el valor definido por defecto.</p></div>`;
}
