// check_data.mjs - fetch and analyze raw Apps Script data
import https from 'https';
import http from 'http';

const url = 'https://script.google.com/macros/s/AKfycby4kur0pR41dc5x4TL1vUSk4EfXfU2GWvBJIvaAnswF39cwol6TjmrhGGITryOTRokH/exec';

function fetch(u) {
  return new Promise((resolve, reject) => {
    const mod = u.startsWith('https') ? https : http;
    mod.get(u, { redirect: 'follow' }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

(async () => {
  const raw = await fetch(url);
  const d = JSON.parse(raw);
  
  console.log('=== ALL KEYS ===');
  Object.keys(d).forEach(k => {
    if (Array.isArray(d[k])) {
      console.log(k + ': ' + d[k].length + ' rows');
    } else {
      console.log(k + ': ' + d[k]);
    }
  });

  console.log('\n=== CATALOG SHEETS ===');
  ['topuni_catalog', 'topclass_catalog', 'giasu_catalog'].forEach(k => {
    const v = d[k] || [];
    console.log('\n--- ' + k + ' (' + v.length + ' rows) ---');
    for (let i = 0; i < Math.min(3, v.length); i++) {
      console.log('Row ' + i + ':', JSON.stringify(v[i]).slice(0, 500));
    }
  });

  console.log('\n=== PROMO SHEETS ===');
  ['topuni', 'topclass', 'giasu'].forEach(k => {
    const v = d[k] || [];
    console.log('\n--- ' + k + ' (' + v.length + ' rows) ---');
    for (let i = 0; i < Math.min(5, v.length); i++) {
      console.log('Row ' + i + ':', JSON.stringify(v[i]).slice(0, 500));
    }
  });
})();
