// Métricas on-chain: datos de Bitview (bitview.space) y cálculos locales (MVRV, media 200 semanas, RSI, ATH, halvings)
const BV = 'https://bitview.space/api';
const DAY = 864e5;
const START = '2010-08-17';          // primer día con precio
const WEEKS200 = 200 * 7;            // 200 semanas en días

const getJson = async url => {
  const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`${r.status} en ${url.replace(BV, '')}`);
  return r.json();
};

/* ---------- Cálculos (funciones puras) ---------- */
export const ffill = a => { let last = null; return a.map(v => (v == null ? last : (last = v))); };

/** Media móvil simple de n valores; null hasta tener n valores */
export function sma(vals, n) {
  const f = ffill(vals), out = Array(f.length).fill(null);
  let sum = 0, count = 0;
  for (let i = 0; i < f.length; i++) {
    if (f[i] == null) continue;
    sum += f[i]; count++;
    if (count > n) { sum -= f[i - n]; count--; }
    if (count === n) out[i] = sum / n;
  }
  return out;
}

/** RSI de Wilder (por defecto 14 periodos) */
export function rsi(vals, n = 14) {
  const f = ffill(vals), out = Array(f.length).fill(null);
  const idx = f.map((v, i) => (v == null ? -1 : i)).filter(i => i >= 0);
  if (idx.length <= n) return out;
  let gain = 0, loss = 0;
  for (let k = 1; k <= n; k++) { const d = f[idx[k]] - f[idx[k - 1]]; d >= 0 ? (gain += d) : (loss -= d); }
  gain /= n; loss /= n;
  const val = () => (loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss));
  out[idx[n]] = val();
  for (let k = n + 1; k < idx.length; k++) {
    const d = f[idx[k]] - f[idx[k - 1]];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[idx[k]] = val();
  }
  return out;
}

const HALVING_DATES = { 1: '2012-11-28', 2: '2016-07-09', 3: '2020-05-11', 4: '2024-04-20' };
/** Ciclo de halvings a partir de la altura de bloque actual (cada 210.000 bloques) */
export function halvingInfo(tip, now = Date.now()) {
  const epoch = Math.floor(tip / 210000), prevH = epoch * 210000, nextH = prevH + 210000;
  const prevDate = HALVING_DATES[epoch] ? Date.parse(HALVING_DATES[epoch]) : now - (tip - prevH) * 600000;
  const remBlocks = nextH - tip;
  return {
    tip, prevH, nextH, prevDate, remBlocks,
    nextDate: now + remBlocks * 600000,                 // estimación a 10 min por bloque
    progress: (tip - prevH) / 210000 * 100,
    elapsedDays: (now - prevDate) / DAY, remainingDays: remBlocks * 10 / 1440,
  };
}

/* ---------- Descarga ---------- */
async function fetchDaily(name) {
  const j = await getJson(`${BV}/series/${encodeURIComponent(name)}/day1?start=${START}`);
  if (!Array.isArray(j.data) || !j.data.length) throw new Error(`${name}: sin datos`);
  const guess = Date.UTC(2009, 0, 3) + (Number(j.start) || 0) * DAY;       // día 0 = bloque génesis
  const t0 = Math.abs(guess - Date.parse(START)) <= 3 * DAY ? guess : Date.parse(START);
  return { name, type: String(j.type || ''), t: j.data.map((_, i) => t0 + i * DAY), v: j.data.map(x => (x == null ? null : +x)) };
}

// Si el nombre exacto de la serie falla, se busca por palabras (la API lo permite)
async function fetchDailyOrSearch(name, query, re) {
  try { return await fetchDaily(name); }
  catch (e) {
    const list = await getJson(`${BV}/series/search?q=${encodeURIComponent(query)}&limit=30`).catch(() => []);
    const alt = (Array.isArray(list) ? list : []).filter(n => re.test(n)).sort((a, b) => a.length - b.length)[0];
    if (!alt) throw e;
    return fetchDaily(alt);
  }
}

const maxOf = a => a.reduce((m, x) => (x != null && x > m ? x : m), 0);
const scale = (s, cents) => ({ ...s, v: s.v.map(x => (x == null ? null : cents ? x / 100 : x)) });

async function fetchTip() {
  for (const u of ['https://mempool.space/api/blocks/tip/height', `${BV}/blocks/tip/height`]) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
      const n = r.ok ? parseInt(await r.text(), 10) : 0;
      if (n > 0) return n;
    } catch { /* siguiente fuente */ }
  }
  return null;
}

export async function loadMetrics() {
  const [p, r, tip] = await Promise.allSettled([
    fetchDailyOrSearch('price_close', 'price close', /(^|_)price_close$/),
    fetchDailyOrSearch('realized_price', 'realized price', /^realized_price$|(^|_)realized_price$/),
    fetchTip(),
  ]);
  if (p.status === 'rejected') throw new Error(`No se pudo leer el precio histórico de Bitview (${p.reason.message}).`);
  const errors = [];

  const priceCents = /cent/i.test(p.value.type) || maxOf(p.value.v) > 5e6;
  const price = scale(p.value, priceCents);
  const t = price.t, pv = price.v;

  let realized = t.map(() => null);
  if (r.status === 'fulfilled') {
    const cents = /cent/i.test(r.value.type) || (priceCents && !/dollar/i.test(r.value.type));
    const rs = scale(r.value, cents), map = new Map(rs.t.map((x, i) => [x, rs.v[i]]));
    realized = t.map(x => map.get(x) ?? null);
  } else errors.push('precio realizado y MVRV');

  const mvrv = pv.map((v, i) => (v != null && realized[i] > 0 ? v / realized[i] : null));
  const ma200 = sma(pv, WEEKS200);
  const rsi14 = rsi(pv, 14);

  let ath = { value: 0, t: 0 };
  pv.forEach((v, i) => { if (v != null && v > ath.value) ath = { value: v, t: t[i] }; });
  const lastIdx = pv.reduce((m, v, i) => (v != null ? i : m), -1);
  const at = a => (lastIdx >= 0 ? a[lastIdx] : null);

  return {
    t, price: pv, realized, mvrv, ma200, rsi: rsi14, ath, errors,
    last: { t: t[lastIdx], price: at(pv), realized: at(realized), mvrv: at(mvrv), ma200: at(ma200), rsi: at(rsi14) },
    tip: tip.status === 'fulfilled' ? tip.value : null,
  };
}
