import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

// OPTIONAL: dacă vrei .env (trebuie: npm i dotenv)
// import 'dotenv/config';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * ============================
 * Basic health check ✅
 * ============================
 */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, riotKey: !!process.env['RIOT_API_KEY'] });
});

/**
 * ============================
 * Riot API Proxy (server-side)
 * ============================
 * Folosești în Angular:
 *   /api/riot/europe/...
 *   /api/riot/euw1/...
 */
const RIOT_API_KEY = process.env['RIOT_API_KEY'];
console.log('RIOT_API_KEY set?', !!RIOT_API_KEY, 'len=', RIOT_API_KEY?.length);

const ALLOWED_HOSTS = new Set([
  // platform routing
  'br1',
  'eun1',
  'euw1',
  'jp1',
  'kr',
  'la1',
  'la2',
  'na1',
  'oc1',
  'ph2',
  'ru',
  'sg2',
  'th2',
  'tr1',
  'tw2',
  'vn2',
  // regional routing
  'americas',
  'europe',
  'asia',
  'sea',
]);

/**
 * ✅ Compat: dacă mai ai cod vechi care apelează /riot/...
 * îl mapăm automat către /api/riot/...
 */
app.use('/riot', (req, _res, next) => {
  req.url = req.originalUrl.replace(/^\/riot/, '/api/riot');
  next();
});

app.use('/api/riot', async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const parts = req.path.split('/').filter(Boolean);
    const host = parts.shift(); // europe / euw1 etc
    const path = parts.join('/');

    if (!host || !path) {
      res.status(400).json({ error: 'Bad request: missing host/path' });
      return;
    }

    if (!ALLOWED_HOSTS.has(host)) {
      res.status(400).json({ error: 'Host not allowed' });
      return;
    }

    if (!RIOT_API_KEY) {
      res.status(500).json({ error: 'Missing RIOT_API_KEY on server' });
      return;
    }

    const qs = new URLSearchParams(req.query as any).toString();
    const url = `https://${host}.api.riotgames.com/${path}${qs ? `?${qs}` : ''}`;

    const r = await fetch(url, { headers: { 'X-Riot-Token': RIOT_API_KEY } });

    // forward content-type (important)
    const ct = r.headers.get('content-type') || 'application/json; charset=utf-8';
    res.status(r.status);
    res.setHeader('content-type', ct);

    // forward Riot rate-limit headers (useful for debug)
    const rl1 = r.headers.get('x-app-rate-limit');
    const rl2 = r.headers.get('x-app-rate-limit-count');
    const rl3 = r.headers.get('x-method-rate-limit');
    const rl4 = r.headers.get('x-method-rate-limit-count');
    if (rl1) res.setHeader('x-app-rate-limit', rl1);
    if (rl2) res.setHeader('x-app-rate-limit-count', rl2);
    if (rl3) res.setHeader('x-method-rate-limit', rl3);
    if (rl4) res.setHeader('x-method-rate-limit-count', rl4);

    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'Proxy error' });
  }
});

/**
 * ======================================
 * DataDragon Proxy (server-side)
 * ======================================
 * În Angular folosești:
 *   /champion-data/api/versions.json
 *   /champion-data/cdn/<ver>/...
 */
app.use('/champion-data', async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const targetUrl =
      'https://ddragon.leagueoflegends.com' + req.originalUrl.replace('/champion-data', '');

    const r = await fetch(targetUrl);

    const ct = r.headers.get('content-type') ?? 'application/octet-stream';
    res.status(r.status);
    res.setHeader('content-type', ct);

    // ✅ cache ok pentru assets static (imagini/json)
    // (ddragon e static; browser-ul va cache-ui)
    res.setHeader('cache-control', 'public, max-age=86400'); // 1 zi

    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'DataDragon proxy error' });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

/**
 * SSR handler
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * ✅ Error handler (ca să vezi clar ce se întâmplă)
 */
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('SERVER ERROR:', err);
  res.status(500).json({ error: err?.message ?? 'Server error' });
});

/**
 * Start server
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
