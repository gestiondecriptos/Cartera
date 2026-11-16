import { usd, qty, pct, cls, fmt, stackedBar, short } from '../format.js';
import { computeDcaTable } from '../accounting.js';

export function render({ view, state, market, ledger = [] }) {
  const price = market.prices.BTC.usd;
  const src = (view.holdings.find(h => h.symbol === 'BTC')?.sources || []).filter(s => s.amount > 0);
  const sum = f => src.filter(f).reduce((t, s) => t + s.amount, 0);
  const onchain = s => s.network === 'Bitcoin';
  const anon = sum(onchain), kyc = sum(s => !onchain(s));

  const bars = [
    stackedBar('Anónimo (No-KYC) vs KYC', [
      { label: 'Anónimo', value: anon, color: '#22c55e' }, { label: 'KYC', value: kyc, color: '#f7931a' }]),
    stackedBar('KYC: autocustodia vs exchange', [
      { label: 'Autocustodia', value: sum(s => !onchain(s) && s.custody !== 'exchange'), color: '#38bdf8' },
      { label: 'Exchange', value: sum(s => !onchain(s) && s.custody === 'exchange'), color: '#a78bfa' }]),
    stackedBar('Tipo de BTC', [
      { label: 'BTC onchain', value: anon, color: '#f7931a' },
      { label: 'WBTC', value: sum(s => s.raw === 'WBTC'), color: '#38bdf8' },
      { label: 'BTCB', value: sum(s => s.raw === 'BTCB'), color: '#fbbf24' },
      { label: 'BTC Exchanges', value: sum(s => s.raw === 'BTC' && !onchain(s)), color: '#a78bfa' }]),
  ].join('');

  const L = ledger, priced = L.filter(r => r.price);
  const totalBtc = priced.reduce((t, r) => t + r.amount, 0);
  const avg = totalBtc ? priced.reduce((t, r) => t + r.amount * r.price, 0) / totalBtc : 0;
  const avgVar = avg ? (price / avg - 1) * 100 : 0;
  const ledgerRows = L.map(r => {
    const v = r.price ? (price / r.price - 1) * 100 : null;
    return `<tr><td class="num" title="${r.address}">${short(r.address)}</td><td class="num">${r.date}</td><td class="num r">${qty(r.amount)}</td><td class="num r">${r.price ? usd(r.price) : '—'}</td><td class="num r ${cls(v)}">${v == null ? '—' : pct(v)}</td></tr>`;
  }).join('');

  const dca = computeDcaTable(state.dca, price);
  const dcaRows = dca.map(r => `<tr><td class="num">${r.month}</td><td class="num r">${usd(r.buyUsd)}</td><td class="num r">${usd(r.debt)}</td><td class="num r">${fmt(r.ltv)}%</td><td class="num r">${qty(r.btc)}</td><td class="num r ${cls(r.valueNoDebt)}">${usd(r.valueNoDebt)}</td><td class="num r">${r.buyPriceEst == null ? '—' : usd(r.buyPriceEst)}</td></tr>`).join('');

  document.getElementById('bitcoin-root').innerHTML = `
    <div class="card space-y-4"><h2 class="font-semibold">Distribución de tu BTC</h2>${bars}</div>
    <div class="grid gap-4 lg:grid-cols-3">
      <div class="card scroll-x lg:col-span-2"><h2 class="mb-2 font-semibold">BTC Ledger anónimo</h2>
        <table class="tbl"><thead><tr><th>Wallet</th><th>Fecha</th><th class="r">Cantidad</th><th class="r">Precio a fecha</th><th class="r">Variación</th></tr></thead><tbody>${ledgerRows}</tbody></table>
        <p class="label mt-3">${L.length ? '' : 'Cargando compras (o aún no hay ingresos). '}Cada ingreso confirmado en tus direcciones cuenta como una compra, al precio de BTC de ese momento (mempool.space). Los traspasos entre tus propias direcciones también aparecerían así.</p></div>
      <div class="card flex flex-col items-center justify-center gap-2">
        <div class="label">Precio medio de compra</div>
        <div class="flex h-44 w-44 flex-col items-center justify-center rounded-full border-[10px] border-[#f7931a]">
          <div class="num text-xl">${totalBtc ? usd(avg) : '—'}</div><div class="num text-sm ${cls(avgVar)}">${totalBtc ? pct(avgVar) : ''}</div></div>
        <div class="label">${qty(totalBtc)} BTC · precio actual ${usd(price)}</div></div>
    </div>
    <div class="card scroll-x"><h2 class="mb-2 font-semibold">Estrategia DCA con BTC como colateral</h2>
      ${dca.length ? `<table class="tbl"><thead><tr><th>Mes</th><th class="r">Compra</th><th class="r">Deuda</th><th class="r">% LTV</th><th class="r">BTC acumulado</th><th class="r">Valor sin deuda</th><th class="r">Precio compra est.</th></tr></thead><tbody>${dcaRows}</tbody></table>`
        : '<p class="label">Aún no hay meses. Añádelos en la pestaña «Datos manuales».</p>'}</div>`;
}
