// Lee el «Crypto Liquidation Heatmap» de CoinGecko (la web se dibuja con JavaScript, por eso hace falta un navegador).
// Guarda data/cgliq.json con los datos que encuentre y un trozo del texto leído («raw») para poder ajustar la lectura.
// Si algo falla, no da error: la tarjeta de la web mostrará «no disponible».
import fs from 'node:fs';

const URL = 'https://www.coingecko.com/en/charts/liquidation-heatmap';
const UNIT = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
export const toNum = s => {                               // "$1.2B" → 1200000000 · "12,345" → 12345
  const m = /([\d.,]+)\s*([KMBT])?/.exec(String(s || '').replace(/\s/g, ''));
  return m ? parseFloat(m[1].replace(/,/g, '')) * (UNIT[m[2]] || 1) : NaN;
};

/** Extrae datos del texto visible de la página ya dibujada */
export function parseCgLiq(text) {
  const t = String(text).replace(/\r/g, '');
  const i = t.search(/Shorts above/i), j = t.search(/\bFAQs?\b/);
  const seg = i >= 0 ? t.slice(i, j > i ? j : i + 2500) : '';
  if (!seg) return null;
  const after = label => {                                 // primera línea con contenido tras la etiqueta
    const m = new RegExp(label + '[^\\n]*\\n+\\s*([^\\n]+)', 'i').exec(seg);
    const same = new RegExp(label + '\\s*[↑↓]?\\s*([\\$\\d][^\\n]*)', 'i').exec(seg);
    const v = (same ? same[1] : m ? m[1] : '').trim();
    return v && v !== '–' && v !== '-' ? v : null;
  };
  const shortsAbove = after('Shorts above'), longsBelow = after('Longs below');
  const rows = [];
  for (const line of seg.split('\n')) {                    // filas de la tabla: Falls to · Longs · Move · Shorts · Rises to
    const c = line.split('\t').map(x => x.trim()).filter(Boolean);
    if (c.length === 5 && /%/.test(c[2])) rows.push({ fallsTo: c[0], longs: c[1], move: c[2], shorts: c[3], risesTo: c[4] });
  }
  const row5 = rows.find(r => /^[±+-]?\s*5(\.0+)?\s*%$/.test(r.move)) || null;
  // Mayor acumulación: mayor salto entre filas consecutivas (los totales son acumulados al alejarse del precio)
  let top = null;
  const scan = (key, side, priceKey) => {
    let prev = 0;
    rows.forEach((r, k) => {
      const v = toNum(r[key]);
      if (!Number.isFinite(v)) return;
      const d = v - prev; prev = v;
      if (!top || d > top.delta) top = { side, delta: d, from: k ? rows[k - 1][priceKey] : null, to: r[priceKey], move: r.move };
    });
  };
  scan('longs', 'Longs', 'fallsTo'); scan('shorts', 'Shorts', 'risesTo');
  if (!shortsAbove && !longsBelow && !row5) return null;
  return { shortsAbove, longsBelow, row5, top, rows, raw: seg.slice(0, 1500) };
}

if (process.argv[1] && process.argv[1].endsWith('cgliq.mjs')) {
  // Seguro anti-bloqueo: pase lo que pase, el script termina en menos de 2,5 minutos
  const guard = setTimeout(() => { console.log('CoinGecko heatmap: tiempo máximo superado.'); process.exit(0); }, 150000);
  let b = null;
  try {
    const { chromium } = await import('playwright');
    b = await chromium.launch();
    const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForFunction(() => /Shorts above/i.test(document.body.innerText) && !/Loading live data/i.test(document.body.innerText), null, { timeout: 45000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const text = await p.evaluate(() => document.body.innerText);
    const o = parseCgLiq(text);
    const k = text.search(/Shorts above/i);
    console.log('--- texto leído (extracto) ---\n' + (k >= 0 ? text.slice(k, k + 2400) : text.slice(0, 1500)) + '\n--- fin ---');
    if (!o) console.log('CoinGecko heatmap: no se pudo leer. Se deja data/cgliq.json como está.');
    else { fs.writeFileSync('data/cgliq.json', JSON.stringify({ updated: new Date().toISOString(), asset: 'BTC', ...o, source: URL }) + '\n'); console.log('CoinGecko heatmap guardado.'); }
  } catch (e) {
    console.log('CoinGecko heatmap: error —', e.message);
  } finally {
    try { if (b) await b.close(); } catch { /* ya cerrado */ }
    clearTimeout(guard);
    process.exit(0);
  }
}
