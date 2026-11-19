// Lee el resumen del monitor de ETFs de Bitcoin (axeladlerjr.com) y lo guarda en data/etf.json.
// Lo ejecuta GitHub Actions. Si la web cambia y no se puede leer, no toca nada y no da error.
import fs from 'node:fs';

const URL = 'https://axeladlerjr.com/charts/bitcoin-etf-flow-monitor/';
const UNIT = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

const money = s => {                                        // "−$86.7M" → -86700000
  const m = /([−+-])?\s*\$\s*([\d.,]+)\s*([KMBT])?/.exec(s || '');
  if (!m) return NaN;
  const v = parseFloat(m[2].replace(/,/g, '')) * (UNIT[m[3]] || 1);
  return m[1] === '−' || m[1] === '-' ? -v : v;
};

export function parseEtf(html) {
  const text = String(html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&minus;|&#8722;/g, '−')
    .replace(/\s+/g, ' ');
  const val = '([−+-]?\\s*\\$\\s*[\\d.,]+\\s*[KMBT]?)';
  const day = /Last day\s*([−+-]?\s*\$\s*[\d.,]+\s*[KMBT]?)\s*([A-Z][a-z]{2} \d{1,2}, \d{4})/.exec(text);
  const week = new RegExp('This week\\s*' + val + '\\s*Full trading sessions').exec(text);
  const implied = /Implied price\s*\$\s*([\d.,]+)/.exec(text);
  if (!day || !week || !implied) return null;
  const out = {
    asOf: new Date(Date.parse(day[2] + ' UTC')).toISOString().slice(0, 10),
    lastDay: money(day[1]), week: money(week[1]), impliedPrice: parseFloat(implied[1].replace(/,/g, '')),
  };
  const ok = Number.isFinite(out.lastDay) && Number.isFinite(out.week) && out.impliedPrice > 1000 && out.impliedPrice < 1e7
    && Math.abs(out.lastDay) < 1e10 && Math.abs(out.week) < 5e10 && /^\d{4}-\d\d-\d\d$/.test(out.asOf);
  return ok ? out : null;
}

if (process.argv[1] && process.argv[1].endsWith('etf.mjs')) {
  try {
    const r = await fetch(URL, { headers: { 'user-agent': 'Mozilla/5.0 (cartera-dashboard)' }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const e = parseEtf(await r.text());
    if (!e) { console.log('ETF: no se pudo leer el resumen (la web puede haber cambiado). Se deja data/etf.json como está.'); process.exit(0); }
    fs.writeFileSync('data/etf.json', JSON.stringify({ updated: new Date().toISOString(), ...e, source: URL }, null, 1) + '\n');
    console.log('ETF guardado:', e);
  } catch (err) { console.log('ETF: error al leer —', err.message); }
}
