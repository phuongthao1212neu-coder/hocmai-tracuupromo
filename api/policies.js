// api/policies.js
// Vercel serverless function — proxy Google Apps Script + parse + normalize.
// Phục vụ HOCMAI Sales Policy Lookup — data chung cho cả TVV và Đại sứ.
// Frontend quyết định hiển thị mã Cart hay mã AMS dựa trên role.

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycby4kur0pR41dc5x4TL1vUSk4EfXfU2GWvBJIvaAnswF39cwol6TjmrhGGITryOTRokH/exec';

// =========================================================================
// Helpers: thời gian
// =========================================================================
function getTodayGMT7() {
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const gmt7 = new Date(utcMs + 7 * 60 * 60 * 1000);
  const y = gmt7.getFullYear();
  const m = String(gmt7.getMonth() + 1).padStart(2, '0');
  const d = String(gmt7.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateRange(rangeStr) {
  if (!rangeStr || typeof rangeStr !== 'string') return { start: null, end: null };
  const cleaned = rangeStr.replace(/^(Từ|Đến)\s+/i, '').trim();
  const parts = cleaned.split('-').map(s => s.trim());
  if (parts.length < 2) return { start: null, end: null };
  const parseDate = (str, refYear) => {
    const s = str.trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    if (!m) return null;
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    const y = m[3] || refYear;
    return `${y}-${mo}-${d}`;
  };
  const yearMatch = rangeStr.match(/\/(\d{4})/);
  const refYear = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
  return {
    start: parseDate(parts[0], refYear),
    end: parseDate(parts[parts.length - 1], refYear)
  };
}

function extractDateRange(text) {
  const m = text.match(/\(([^)]+)\)/);
  return m ? m[1] : '';
}

function isActive(today, rangeStr) {
  const { start, end } = parseDateRange(rangeStr);
  if (!start || !end) return false;
  return today >= start && today <= end;
}

// =========================================================================
// Catalog parsing helpers
// =========================================================================
function normalizeCatalogKey(header) {
  if (!header) return null;
  const lower = String(header).toLowerCase().trim();
  const known = {
    'danh mục sản phẩm': 'name',
    'học phí niêm yết': 'listPrice',
    'lớp': 'grade',
    'môn': 'subject',
    'loại sản phẩm': 'productType',
    'gói học phí': 'feePackage',
    'hình thức học': 'form'
  };
  if (known[lower]) return known[lower];
  const cleaned = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  return cleaned.map((w, i) => i === 0 ? w : w[0].toUpperCase() + w.slice(1)).join('');
}

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

function coerceValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : String(v);
  if (typeof v === 'boolean') return v;
  const s = String(v).trim();
  if (s === '') return null;
  const num = parseFloat(s.replace(/,/g, ''));
  if (!Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(s.replace(/,/g, ''))) return num;
  return s;
}

function parseCatalog(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const header = rows[0];
  if (!Array.isArray(header)) return [];
  const keys = header.map(normalizeCatalogKey);
  const items = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    if (row.every(isEmpty)) continue;
    const item = {};
    let hasAny = false;
    for (let c = 0; c < keys.length; c++) {
      const key = keys[c];
      if (!key) continue;
      const v = row[c];
      if (isEmpty(v)) continue;
      item[key] = coerceValue(v);
      hasAny = true;
    }
    if (hasAny) items.push(item);
  }
  return items;
}

// =========================================================================
// Promotion parsing
// =========================================================================
function getPromotionType(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('ngày vàng')) return 'golden';
  if (lower.includes('ngày thường')) return 'normal';
  return 'unknown';
}

function determineCustomerType(text) {
  const s = String(text || '').toLowerCase();
  if (s.includes('nâng cấp')) return 'upgrade';
  if (s.includes('lần đầu') || s.includes('mới')) return 'new';
  if (s.includes('cũ')) return 'old';
  if (s.includes('mọi đối tượng') || s.includes('áp dụng với')) return 'all';
  return 'unknown';
}

function fieldNameToKey(label) {
  const s = String(label || '').trim().toLowerCase();
  if (s.includes('học phí') || s.includes('hp sau') || s.includes('học phí thực đóng')) return 'price';
  if (s.includes('ams')) return 'ams';
  if (s.includes('mã')) return 'code';
  if (s.includes('ưu đãi') || s.includes('voucher')) return 'discount';
  return null;
}

function parseSheetPromotions(rows, fixedColMap) {
  if (!Array.isArray(rows) || rows.length < 4 || !Array.isArray(fixedColMap) || fixedColMap.length === 0) {
    return { periods: [], items: [] };
  }
  const mainHdr = rows[0];
  const subHdr = rows[1];
  const custHdr = rows[2];
  const dataRows = rows.slice(3);
  const totalCols = Math.max(mainHdr.length, subHdr.length, custHdr.length);
  const FIXED = Math.max(...fixedColMap.map(fc => fc.col)) + 1;
  const periods = [];
  for (let c = FIXED; c < totalCols; c++) {
    const v = String(mainHdr[c] || '').trim();
    if (v) {
      periods.push({ name: v, type: getPromotionType(v), dateRange: extractDateRange(v), colStart: c, colEnd: totalCols });
      if (periods.length > 1) periods[periods.length - 2].colEnd = c;
    }
  }
  for (const period of periods) {
    period.custs = [];
    let currentCust = null;
    for (let c = period.colStart; c < period.colEnd && c < totalCols; c++) {
      const v = String(custHdr[c] || '').trim();
      if (v) {
        currentCust = determineCustomerType(v);
        period.custs.push({ type: currentCust, colStart: c, colEnd: period.colEnd, fields: {} });
      }
    }
    for (let i = 0; i < period.custs.length; i++) {
      if (i < period.custs.length - 1) period.custs[i].colEnd = period.custs[i + 1].colStart;
    }
    for (const seg of period.custs) {
      for (let c = seg.colStart; c < seg.colEnd; c++) {
        const f = String(subHdr[c] || '').trim();
        if (!f) continue;
        const key = fieldNameToKey(f);
        if (!key) continue;
        if (key === 'code' && seg.fields.codeCol === undefined) seg.fields.codeCol = c;
        else if (key === 'ams') seg.fields.amsCol = c;
        else if (key === 'discount') seg.fields.discountCol = c;
        else if (key === 'price') seg.fields.priceCol = c;
      }
    }
  }
  const items = [];
  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const row = dataRows[rowIdx];
    if (!Array.isArray(row)) continue;
    if (row.every(isEmpty)) continue;
    const item = {};
    for (const fc of fixedColMap) {
      const rawVal = row[fc.col];
      if (fc.asNumber) { const v = coerceValue(rawVal); if (v !== null) item[fc.key] = v; }
      else { const s = String(rawVal || '').trim(); if (s) item[fc.key] = s; }
    }
    if (Object.keys(item).length === 0) continue;
    for (const period of periods) {
      const prom = {};
      for (const seg of period.custs) {
        const data = {};
        if (seg.fields.discountCol !== undefined) {
          const dv = coerceValue(row[seg.fields.discountCol]);
          if (typeof dv === 'number') data.discount = dv;
        }
        if (seg.fields.codeCol !== undefined) {
          const code = String(row[seg.fields.codeCol] || '').trim();
          if (code) data.code = code;
        }
        if (seg.fields.amsCol !== undefined) {
          const ams = String(row[seg.fields.amsCol] || '').trim();
          if (ams) data.amsCode = ams;
        }
        if (seg.fields.priceCol !== undefined) {
          const pv = coerceValue(row[seg.fields.priceCol]);
          if (typeof pv === 'number') data.finalPrice = pv;
        }
        if (Object.keys(data).length > 0) prom[seg.type] = data;
      }
      if (Object.keys(prom).length > 0) {
        if (!item.promotions) item.promotions = {};
        item.promotions[period.name] = prom;
      }
    }
    items.push(item);
  }
  return { periods, items };
}

function parseTopuniPromotions(rows) {
  const result = parseSheetPromotions(rows, [
    { col: 0, key: 'stt', asNumber: true },
    { col: 1, key: 'packageName' },
    { col: 2, key: 'productName' },
    { col: 3, key: 'components' },
    { col: 4, key: 'listPrice', asNumber: true }
  ]);
  for (const item of result.items) {
    const pn = item.productName || '';
    item.products = typeof pn === 'string' && pn.indexOf('\n') !== -1
      ? pn.split('\n').map(s => s.trim()).filter(Boolean)
      : pn ? [pn.trim()] : [];
    const pkg = (item.packageName || '').trim();
    item.isComboRule = pkg.startsWith('Combo');
  }
  const merged = [];
  for (const item of result.items) {
    const pkg = (item.packageName || '').trim();
    const hasProduct = (item.productName || '').trim() !== '';
    const isCont = pkg === '' && item.listPrice == null && hasProduct;
    if (isCont && merged.length > 0) {
      const prev = merged[merged.length - 1];
      const prod = item.productName.trim();
      if (prod) prev.products.push(prod);
    } else {
      merged.push(item);
    }
  }
  result.items = merged;
  return result;
}

function parseTopclassPromotions(rows) {
  return parseSheetPromotions(rows, [
    { col: 0, key: 'productType' }, { col: 1, key: 'feePackage' },
    { col: 2, key: 'gradeLevel' }, { col: 3, key: 'subject' },
    { col: 4, key: 'quantity', asNumber: true }
  ]);
}

function parseGiasuPromotions(rows) {
  return parseSheetPromotions(rows, [
    { col: 0, key: 'name' }, { col: 1, key: 'sessions', asNumber: true },
    { col: 2, key: 'pricePerSession', asNumber: true }, { col: 3, key: 'totalListPrice', asNumber: true }
  ]);
}

function forwardFillTopclass(items) {
  let lastType = '', lastPackage = '', lastGrade = '', lastSubject = '';
  for (const item of items) {
    if (item.productType) lastType = item.productType; else item.productType = lastType;
    if (item.feePackage) lastPackage = item.feePackage; else item.feePackage = lastPackage;
    if (item.gradeLevel) lastGrade = item.gradeLevel; else item.gradeLevel = lastGrade;
    if (item.subject) lastSubject = item.subject; else item.subject = lastSubject;
  }
}

function parseGradeList(gradeStr) {
  if (!gradeStr) return [];
  const matches = String(gradeStr).match(/\d+/g);
  return matches ? matches.map(Number) : [];
}

function parseSubjectList(subjectStr) {
  if (!subjectStr) return [];
  const s = String(subjectStr).trim();
  if (/nhiều môn|tất cả|mọi môn/i.test(s)) return null;
  return s.split('/').map(x => x.trim()).filter(Boolean);
}

function parseSessionsFromName(name) {
  if (!name) return null;
  const m = String(name).match(/(\d+)\s*buổi/i);
  return m ? parseInt(m[1], 10) : null;
}

// Matching functions - match catalog item with promotion item
function matchTopuniCatalog(cat, pro) {
  return Number(cat.listPrice) > 0 && Number(cat.listPrice) === Number(pro.listPrice);
}
function matchTopclassCatalog(cat, pro) {
  if (!pro.productType || !pro.feePackage) return false;
  if (cat.productType !== pro.productType) return false;
  if (cat.feePackage !== pro.feePackage) return false;
  const grades = parseGradeList(pro.gradeLevel);
  if (grades.length > 0 && !grades.includes(Number(cat.grade))) return false;
  const subjects = parseSubjectList(pro.subject);
  if (subjects === null) return true;
  if (subjects.length === 0) return true;
  return subjects.some(s => s.toLowerCase() === String(cat.subject || '').trim().toLowerCase());
}
function matchGiasuCatalog(cat, pro) {
  const sess = parseSessionsFromName(cat.name);
  if (!sess || !pro.sessions) return false;
  if (sess !== Number(pro.sessions)) return false;
  return Number(cat.listPrice) > 0 && Number(cat.listPrice) === Number(pro.totalListPrice);
}

function enrichCatalogWithPromotions(catalogItems, promotionItems, matchFn) {
  for (const cat of catalogItems) {
    cat.promotions = {};
    for (const pro of promotionItems) {
      if (!matchFn(cat, pro)) continue;
      if (!pro.promotions) continue;
      for (const [periodName, seg] of Object.entries(pro.promotions)) {
        if (!cat.promotions[periodName]) cat.promotions[periodName] = {};
        for (const [custType, data] of Object.entries(seg)) {
          cat.promotions[periodName][custType] = data;
        }
      }
    }
  }
}

// =========================================================================
// Handler
// =========================================================================
const RESPONSE_CACHE_TTL_MS = 60 * 1000;
let responseCache = { data: null, expiresAt: 0 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=60, max-age=60, stale-while-revalidate=120');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (responseCache.data && Date.now() < responseCache.expiresAt) {
    res.setHeader('X-Cache', 'HIT-MEMORY');
    return res.status(200).json(responseCache.data);
  }

  const today = getTodayGMT7();
  try {
    const fetchRes = await fetch(APPS_SCRIPT_URL, { redirect: 'follow', headers: { Accept: 'application/json' } });
    if (!fetchRes.ok) {
      return res.status(502).json({ ok: false, error: `Apps Script returned HTTP ${fetchRes.status}`, fetchedAt: new Date().toISOString(), today });
    }
    const raw = await fetchRes.json();

    // Parse catalogs from DanhmucSP sheets
    const catalogs = {
      topuni: parseCatalog(raw.topuni_catalog),
      topclass: parseCatalog(raw.topclass_catalog),
      giasu: parseCatalog(raw.giasu_catalog)
    };

    // Parse promotions from promo sheets
    const topuniPromotions = parseTopuniPromotions(raw.topuni);
    const topclassPromotions = parseTopclassPromotions(raw.topclass);
    forwardFillTopclass(topclassPromotions.items);
    const giasuPromotions = parseGiasuPromotions(raw.giasu);

    // Enrich catalogs with promotion data
    enrichCatalogWithPromotions(catalogs.topuni, topuniPromotions.items, matchTopuniCatalog);
    enrichCatalogWithPromotions(catalogs.topclass, topclassPromotions.items, matchTopclassCatalog);
    enrichCatalogWithPromotions(catalogs.giasu, giasuPromotions.items, matchGiasuCatalog);

    // Get active periods for each category
    const tuActive = topuniPromotions.periods.filter(p => isActive(today, p.dateRange));
    const tcActive = topclassPromotions.periods.filter(p => isActive(today, p.dateRange));
    const gsActive = giasuPromotions.periods.filter(p => isActive(today, p.dateRange));

    const body = {
      status: 'ok', fetchedAt: raw.updatedAt || new Date().toISOString(),
      today, source: 'google-sheet',
      catalogs,
      promotions: {
        topuni: { periods: topuniPromotions.periods, activePeriods: tuActive.map(p => p.name), items: topuniPromotions.items },
        topclass: { periods: topclassPromotions.periods, activePeriods: tcActive.map(p => p.name), items: topclassPromotions.items },
        giasu: { periods: giasuPromotions.periods, activePeriods: gsActive.map(p => p.name), items: giasuPromotions.items }
      }
    };
    responseCache = { data: body, expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS };
    res.setHeader('X-Cache', 'MISS-FETCHED');
    return res.status(200).json(body);
  } catch (err) {
    return res.status(502).json({ ok: false, error: String(err?.message || err), fetchedAt: new Date().toISOString(), today });
  }
}
