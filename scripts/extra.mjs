// Datos extra de la pestaña Métricas, leídos en GitHub Actions (el navegador no puede leer estas webs por CORS):
//  · Fear & Greed de CoinGecko (valor actual + histórico propio acumulado) y, como contexto, alternative.me (desde 2018)
//  · Rainbow Chart de Axel Adler Jr · Liquidaciones de Hyperliquid (mapa de Axel Adler Jr)
// Cada bloque es independiente: si uno falla se deja su archivo como está y no se da error.
import fs from 'node:fs';

const HEAD = { 'user-agent': 'Mozilla/5.0 (cartera-dashboard)', 'accept-language': 'en' };
const UNIT = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
const LAB = 'Extreme Fear|Fear|Neutral|Greed|Extreme Greed';

export const clean = html => String(html)
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&minus;|&#8722;/g, '−')
  .replace(/\s+/g, ' ');
const num = s => parseFloat(String(s).replace(/[,$\s]/g, ''));
const money = s => {                                   // "−$86.7M" → -86700000
  const m = /([−+-])?\s*\$?\s*([\d.,]+)\s*([KMBT])?/.exec(s || '');
  if (!m) return NaN;
  const v = Math.round(parseFloat(m[2].replace(/,/g, '')) * (UNIT[m[3]] || 1));
  return m[1] === '−' || m[1] === '-' ? -v : v;
};
const isoDay = s => new Date(Date.parse(s + ' UTC')).toISOString().slice(0, 10);

/* ---------- Fear & Greed (CoinGecko) ---------- */
export function parseFng(html) {
  const t = clean(html);
  const head = new RegExp(`Fear & Greed:\\s*(${LAB})\\s*\\((\\d{1,3})\\)`).exec(t);
  const main = new RegExp(`Fear & Greed Index\\s+(\\d{1,3})\\s+(${LAB})`).exec(t);
  const value = main ? +main[1] : head ? +head[2] : null;
  if (value == null || value > 100) return null;
  const pick = k => { const m = new RegExp(`${k}\\s*(${LAB})\\s*\\((\\d{1,3})\\)`).exec(t); return m ? +m[2] : null; };
  const st = new RegExp(`in (${LAB}) for (\\d+) consecutive day`).exec(t);
  return {
    value, label: main ? main[2] : head[1], streak: st ? +st[2] : null,
    yesterday: pick('Yesterday'), lastWeek: pick('Last Week'), lastMonth: pick('Last Month'),
    lastGreed: pick('Last in Greed'), ath: pick('All Time High'), atl: pick('All Time Low'),
  };
}
const labelOf = v => (v <= 30 ? 'Extreme Fear' : v <= 45 ? 'Fear' : v <= 55 ? 'Neutral' : v <= 70 ? 'Greed' : 'Extreme Greed');
export function parseGlobalFng(json) {                  // respaldo: /global de la API pública de CoinGecko
  let found = null;
  const walk = (o, k = '') => {
    if (found != null || o == null) return;
    if (typeof o === 'number' && /fear/i.test(k) && o >= 0 && o <= 100) { found = o; return; }
    if (typeof o === 'object') for (const [kk, v] of Object.entries(o)) walk(v, kk);
  };
  walk(json);
  return found == null ? null : { value: Math.round(found), label: labelOf(found), streak: null };
}

/* ---------- Rainbow Chart (Axel Adler Jr) ---------- */
const BANDS = ['Deep discount', 'Discount', 'Below trend', 'Slightly below trend', 'Near trend', 'Above trend', 'Stretched', 'Overheated', 'Extreme'];
export function parseRainbow(html) {
  const t = clean(html);
  const band = new RegExp(`Band\\s*(${[...BANDS].sort((a, b) => b.length - a.length).join('|')})\\s*(\\d)\\s*of\\s*9`).exec(t);
  const price = /BTC price\s*\$\s*([\d,.]+)/.exec(t), model = /Model price\s*\$\s*([\d,.]+)/.exec(t);
  const vs = /vs model\s*([−+-]?\s*[\d.]+)\s*%/.exec(t), date = /As of ([A-Z][a-z]{2} \d{1,2}, \d{4})/.exec(t);
  const edge = k => { const m = new RegExp(`Band ${k}\\s*(\\$\\s*[\\d,.]+|Open-ended)`).exec(t); return !m || /Open/.test(m[1]) ? null : num(m[1]); };
  if (!band || !price || !model || !vs) return null;
  const out = {
    asOf: date ? isoDay(date[1]) : null, band: band[1], index: +band[2], price: num(price[1]), model: num(model[1]),
    vsModel: parseFloat(vs[1].replace('−', '-').replace(/\s/g, '')), floor: edge('floor'), ceiling: edge('ceiling'),
  };
  return out.index >= 1 && out.index <= 9 && out.price > 0 && out.model > 0 ? out : null;
}

/* ---------- Liquidaciones Hyperliquid (Axel Adler Jr) ---------- */
export function parseLiq(html) {
  const t = clean(html);
  const longs = /Longs within [−-]5%\s*(\$\s*[\d.,]+\s*[KMBT]?)/.exec(t), shorts = /Shorts within \+5%\s*(\$\s*[\d.,]+\s*[KMBT]?)/.exec(t);
  const price = /price of \$\s*([\d,]+)/.exec(t), at = /As of ([A-Z][a-z]{2} \d{1,2}, \d{4}), (\d\d:\d\d) UTC/.exec(t);
  if (!longs || !shorts) return null;
  const from = t.indexOf('Largest Bitcoin liquidation levels');
  const rx = /\$\s*([\d,]+)\s*to\s*\$\s*([\d,]+)\s*([−+-]\s*\d+)\s*%\s*(Longs|Shorts)\s*(\$\s*[\d.,]+\s*[KMBT]?)\s*(\d+)/g;
  const levels = [], seg = from >= 0 ? t.slice(from) : t;
  for (let m; (m = rx.exec(seg)) && levels.length < 4;) levels.push({ lo: num(m[1]), hi: num(m[2]), dist: parseFloat(m[3].replace('−', '-').replace(/\s/g, '')), side: m[4], value: money(m[5]), positions: +m[6] });
  const out = {
    asOf: at ? `${isoDay(at[1])} ${at[2]} UTC` : null, price: price ? num(price[1]) : null,
    longs5: money(longs[1]), shorts5: money(shorts[1]), levels,
  };
  return Number.isFinite(out.longs5) && Number.isFinite(out.shorts5) && levels.length ? out : null;
}

/* ---------- Ejecución ---------- */
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const get = async (url, json = false) => {
  const r = await fetch(url, { headers: HEAD, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return json ? r.json() : r.text();
};
const save = (f, o) => fs.writeFileSync(f, JSON.stringify(o) + '\n');

async function runFng() {
  const prev = readJson('data/fng.json') || {};
  let cg = null;
  try { cg = parseFng(await get('https://www.coingecko.com/en/charts/fear-and-greed-index')); } catch (e) { console.log('F&G página:', e.message); }
  if (!cg) { try { cg = parseGlobalFng(await get('https://api.coingecko.com/api/v3/global', true)); } catch (e) { console.log('F&G /global:', e.message); } }
  let alt = prev.alt || [];
  try {
    const j = await get('https://api.alternative.me/fng/?limit=0&format=json', true);
    const a = (j.data || []).map(x => [new Date(+x.timestamp * 1000).toISOString().slice(0, 10), +x.value]).filter(x => x[1] >= 0 && x[1] <= 100).sort((p, q) => (p[0] < q[0] ? -1 : 1));
    if (a.length > 100) alt = a;
  } catch (e) { console.log('F&G alternative.me:', e.message); }
  if (!cg && !prev.cg) { console.log('F&G: sin datos, no se escribe nada.'); return; }
  const today = new Date().toISOString().slice(0, 10), ago = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const hist = prev.hist || [];
  const seed = (d, v) => { if (v != null && !hist.some(x => x[0] === d)) hist.push([d, v]); };
  if (cg) {
    seed(ago(1), cg.yesterday); seed(ago(7), cg.lastWeek); seed(ago(30), cg.lastMonth);
    const i = hist.findIndex(x => x[0] === today);
    if (i >= 0) hist[i][1] = cg.value; else hist.push([today, cg.value]);
  }
  hist.sort((p, q) => (p[0] < q[0] ? -1 : 1));
  save('data/fng.json', { updated: new Date().toISOString(), cg: cg ? { ...cg, asOf: today } : prev.cg, hist, alt });
  console.log('F&G guardado:', cg, '· histórico propio:', hist.length, '· alternative.me:', alt.length);
}
async function runPage(url, parse, file, name) {
  try {
    const o = parse(await get(url));
    if (!o) { console.log(`${name}: no se pudo leer (la web puede haber cambiado). Se deja ${file} como está.`); return; }
    save(file, { updated: new Date().toISOString(), ...o, source: url });
    console.log(`${name} guardado:`, o);
  } catch (e) { console.log(`${name}: error —`, e.message); }
}

if (process.argv[1] && process.argv[1].endsWith('extra.mjs')) {
  await runFng();
  await runPage('https://axeladlerjr.com/charts/bitcoin-rainbow-chart/', parseRainbow, 'data/rainbow.json', 'Rainbow');
  await runPage('https://axeladlerjr.com/charts/bitcoin-liquidation-map/', parseLiq, 'data/liq.json', 'Liquidaciones');
}
