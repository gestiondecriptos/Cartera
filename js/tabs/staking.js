import { usd, qty, pct } from '../format.js';
import { MOCK_STAKING_APR } from '../mock-data.js';

const TOKENS = ['SKY', 'TRX', 'HYPE', 'ATOM', 'PENDLE'];

export function render({ view, market }) {
  const rows = TOKENS.map(sym => {
    const h = view.holdings.find(x => x.symbol === sym);
    const amount = (h?.sources || []).filter(s => s.category === 'staking').reduce((t, s) => t + s.amount, 0);
    const value = amount * (market.prices[sym]?.usd ?? 0);
    const apr = MOCK_STAKING_APR[sym] ?? 0;
    return { sym, amount, value, apr, daily: value * apr / 100 / 365 };
  });
  const tvl = rows.reduce((t, r) => t + r.value, 0);
  const wApr = tvl ? rows.reduce((t, r) => t + r.value * r.apr, 0) / tvl : 0;
  const daily = rows.reduce((t, r) => t + r.daily, 0);

  document.getElementById('staking-root').innerHTML = `
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="card"><div class="label">TVL en staking</div><div class="num text-2xl text-[#38bdf8]">${usd(tvl)}</div></div>
      <div class="card"><div class="label">APR medio ponderado</div><div class="num text-2xl text-[#22c55e]">${pct(wApr, 2)}</div></div>
      <div class="card"><div class="label">Generación diaria</div><div class="num text-2xl">${usd(daily)}</div></div>
    </div>
    <div class="card scroll-x"><table class="tbl">
      <thead><tr><th>Token</th><th class="r">Cantidad</th><th class="r">Valor (USD)</th><th class="r">APR</th><th class="r">Generación diaria (USD)</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td class="font-medium">${r.sym}</td><td class="num r">${qty(r.amount)}</td><td class="num r">${usd(r.value)}</td><td class="num r">${pct(r.apr, 2)}</td><td class="num r">${usd(r.daily)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="label mt-3">Las cantidades salen de tus saldos marcados como staking. Los APR son de ejemplo hasta conectar fuentes reales.</p></div>`;
}
