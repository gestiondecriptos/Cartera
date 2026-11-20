import { usd, qty, pct, cls, fmt, stackedBar, short } from '../format.js';
import { computeDcaTable } from '../accounting.js';
import { WALLETS } from '../config.js';

// Las direcciones no se muestran: Wallet 1, Wallet 2… según su orden en config.js
const walletName = a => { const i = WALLETS.btc.indexOf(a); return i < 0 ? 'Wallet' : `Wallet ${i + 1}`; };
function avgCard({ title, subtitle, avgPrice, curPrice, extraLabel }) {
  const diff = avgPrice ? (curPrice / avgPrice - 1) * 100 : 0;
  const maxRef = Math.max(avgPrice, curPrice, 1);
  const wAvg = Math.round((avgPrice / maxRef) * 100);
  const wCur = Math.round((curPrice / maxRef) * 100);
  return `<div class="card flex flex-col justify-between gap-4">
    <div>
      <div class="label">${title}</div>
      <div class="mt-2 flex items-baseline gap-3">
        <span class="num text-3xl font-semibold text-[#f7931a]">${avgPrice ? usd(avgPrice) : '—'}</span>
        ${avgPrice ? `<span class="num rounded px-2 py-0.5 text-xs font-medium ${diff >= 0 ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-[#ef4444]/15 text-[#f87171]'}">${diff >= 0 ? '+' : ''}${pct(diff)}</span>` : ''}
      </div>
      <div class="label mt-1">${subtitle}</div>
    </div>
    ${avgPrice ? `<div class="space-y-2 border-t border-[#2d3142] pt-3 text-xs">
      <div><div class="flex justify-between text-slate-400"><span>Precio medio</span><span class="num">${usd(avgPrice)}</span></div>
        <div class="mt-1 h-2 rounded bg-[#11131f]"><div class="h-2 rounded bg-[#f7931a]" style="width:${wAvg}%"></div></div></div>
      <div><div class="flex justify-between text-slate-400"><span>Precio actual</span><span class="num">${usd(curPrice)}</span></div>
        <div class="mt-1 h-2 rounded bg-[#11131f]"><div class="h-2 rounded bg-[#38bdf8]" style="width:${wCur}%"></div></div></div>
    </div>` : ''}
    <div class="label">${extraLabel}</div>
  </div>`;
}

export function render({ view, state, market, ledger = [] }) {
  const price = market.prices.BTC.usd;
  const src = (view.holdings.find(h => h.symbol === 'BTC')?.sources || []).filter(s => s.amount > 0);
  const sum = f => src.filter(f).reduce((t, s) => t + s.amount, 0);
  const onchain = s => s.network === 'Bitcoin';
  const isCex = s => s.network === 'CEX' || s.custody === 'exchange';
  const anon = sum(onchain), kyc = sum(s => !onchain(s));
  const pe = market.prices.BTC.eur || price / market.eurUsd;
  const bv = v => `${qty(v)} BTC · ${fmt(v * pe, { style: 'currency', currency: 'EUR' })}`;
  const bars = [
    stackedBar('Anónimo (No-KYC) vs KYC', [
      { label: 'Anónimo', value: anon, color: '#22c55e' }, { label: 'KYC', value: kyc, color: '#f7931a' }], bv),
    stackedBar('KYC: autocustodia vs exchange', [
      { label: 'Autocustodia', value: sum(s => !onchain(s) && !isCex(s)), color: '#38bdf8' },
      { label: 'Exchange', value: sum(s => !onchain(s) && isCex(s)), color: '#a78bfa' }], bv),
    stackedBar('Tipo de BTC', [
      { label: 'BTC onchain', value: anon, color: '#f7931a' },
      { label: 'WBTC', value: sum(s => /wbtc/i.test(s.raw)), color: '#38bdf8' },
      { label: 'BTCB', value: sum(s => /btcb/i.test(s.raw)), color: '#fbbf24' },
      { label: 'cbBTC', value: sum(s => /cbbtc/i.test(s.raw)), color: '#22c55e' },
      { label: 'BTC Exchanges', value: sum(s => isCex(s)), color: '#a78bfa' }], bv),
  ].join('');

  const L = ledger, priced = L.filter(r => r.price);
  const totalBtc = priced.reduce((t, r) => t + r.amount, 0);
  const avg = totalBtc ? priced.reduce((t, r) => t + r.amount * r.price, 0) / totalBtc : 0;
  const ledgerRows = L.map(r => {
    const v = r.price ? (price / r.price - 1) * 100 : null;
    return `<tr><td>${walletName(r.address)}</td><td class="num">${r.date}</td><td class="num r">${qty(r.amount)}</td><td class="num r">${r.price ? usd(r.price) : '—'}</td><td class="num r ${cls(v)}">${v == null ? '—' : pct(v)}</td></tr>`;
  }).join('');

  const dca = computeDcaTable(state.dca, price);
  const dcaEstPrices = dca.map(r => r.buyPriceEst).filter(v => Number.isFinite(v) && v > 0);
  const dcaAvg = dcaEstPrices.length ? dcaEstPrices.reduce((t, v) => t + v, 0) / dcaEstPrices.length : 0;
  const dcaLastBtc = dca.at(-1)?.btc || 0;
  const dcaRows = dca.map(r => {
    const ltvCell = r.ltv == null
      ? '—'
      : Number.isFinite(r.ltv)
        ? `${r.ltv.toFixed(2)}%`
        : '∞';
    return `<tr><td class="num">${r.month}</td><td class="num r">${usd(r.buyUsd)}</td><td class="num r">${usd(r.debt)}</td><td class="num r">${ltvCell}</td><td class="num r">${qty(r.btc)}</td><td class="num r ${cls(r.valueNoDebt)}">${usd(r.valueNoDebt)}</td><td class="num r">${r.buyPriceEst == null ? '—' : usd(r.buyPriceEst)}</td></tr>`;
  }).join('');

  document.getElementById('bitcoin-root').innerHTML = `
    <div class="card space-y-4"><h2 class="font-semibold">Distribución de tu BTC</h2>${bars}</div>
    <div class="grid gap-4 lg:grid-cols-3">
      <div class="card scroll-x lg:col-span-2"><h2 class="mb-2 font-semibold">BTC Ledger anónimo</h2>
        <table class="tbl"><thead><tr><th>Wallet</th><th>Fecha</th><th class="r">Cantidad</th><th class="r">Precio a fecha</th><th class="r">Variación</th></tr></thead><tbody>${ledgerRows}</tbody></table>
        <p class="label mt-3">${L.length ? '' : 'Cargando compras (o aún no hay ingresos). '}Cada ingreso confirmado en tus direcciones cuenta como una compra, al precio de BTC de ese momento (mempool.space).</p></div>
      ${avgCard({
        title: 'Precio medio de compra (Ledger)',
        subtitle: 'Ponderado por ingresos on-chain',
        avgPrice: avg,
        curPrice: price,
        extraLabel: `${qty(totalBtc)} BTC acumulados · ${priced.length} compras`,
      })}
    </div>
    <div class="grid gap-4 lg:grid-cols-3">
      <div class="card scroll-x lg:col-span-2"><h2 class="mb-2 font-semibold">Estrategia DCA con BTC como colateral</h2>
        ${dca.length ? `<table class="tbl"><thead><tr><th>Mes</th><th class="r">Compra</th><th class="r">Deuda</th><th class="r">% LTV</th><th class="r">BTC acumulado</th><th class="r">Valor sin deuda</th><th class="r">Precio compra est.</th></tr></thead><tbody>${dcaRows}</tbody></table>`
          : '<p class="label">Aún no hay meses. Añádelos en data/manual.js (sección dca), una línea por compra.</p>'}</div>
      ${avgCard({
        title: 'Precio medio de compra (DCA)',
        subtitle: 'Media de «Precio compra est.»',
        avgPrice: dcaAvg,
        curPrice: price,
        extraLabel: `${qty(dcaLastBtc)} BTC acumulados · ${dcaEstPrices.length} compras estimadas`,
      })}
    </div>`;
}
