import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * ============================
 * Riot API Proxy (server-side)
 * ============================
 * - Nu expui cheia Riot în browser
 * - Eviți problemele de CORS
 *
 * Folosești în Angular URL-uri de forma:
 *   /api/riot/europe/...   (routing: europe/americas/asia/sea)
 *   /api/riot/euw1/...     (platform: euw1/eun1/na1/etc)
 */

// Express 4 friendly wildcard route:
// - host = req.params.host
// - path = req.params[0]

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

app.use('/api/riot', async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // req.path va fi de forma: /europe/riot/account/v1/...
    const parts = req.path.split('/').filter(Boolean);
    const host = parts.shift(); // europe / euw1 etc
    const path = parts.join('/'); // restul

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
    const text = await r.text();

    res
      .status(r.status)
      .type(r.headers.get('content-type') ?? 'application/json')
      .send(text);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'Proxy error' });
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
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
