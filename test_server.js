const http = require('http');
const { spawn } = require('child_process');

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.statusCode = 200, res.end();

  if (req.url === '/api/policies') {
    try {
      const mod = await import('node-fetch');
      const fetch = mod.default || mod;
      const appsRes = await fetch('https://script.google.com/macros/s/AKfycby4kur0pR41dc5x4TL1vUSk4EfXfU2GWvBJIvaAnswF39cwol6TjmrhGGITryOTRokH/exec', { redirect: 'follow', headers: { Accept: 'application/json' } });
      if (!appsRes.ok) {
        return res.statusCode = 502, res.json({ ok: false, error: `Apps Script returned ${appsRes.status}` });
      }
      const raw = await appsRes.json();

      // Minimal check: confirm data structure keys
      res.json({
        status: 'ok',
        catalogKeys: Object.keys(raw).filter(k => k.endsWith('_catalog')).map(k => ({ key: k, rows: Array.isArray(raw[k]) ? raw[k].length : 0 })),
        promoKeys: Object.keys(raw).filter(k => ['topuni','topclass','giasu'].includes(k)).map(k => ({ key: k, rows: Array.isArray(raw[k]) ? raw[k].length : 0 }))
      });
    } catch (err) {
      res.statusCode = 502;
      res.json({ ok: false, error: err.message });
    }
  } else {
    res.statusCode = 404;
    res.end();
  }
});

server.listen(3000, () => console.log('Test server on http://localhost:3000'));
