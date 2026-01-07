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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, riotKey: !!process.env['RIOT_API_KEY'] });
});

const RIOT_API_KEY = process.env['RIOT_API_KEY'];
console.log('RIOT_API_KEY set?', !!RIOT_API_KEY, 'len=', RIOT_API_KEY?.length);

const ALLOWED_HOSTS = new Set([
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

  'americas',
  'europe',
  'asia',
  'sea',
]);

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
    const host = parts.shift();
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

    const ct = r.headers.get('content-type') || 'application/json; charset=utf-8';
    res.status(r.status);
    res.setHeader('content-type', ct);

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

    res.setHeader('cache-control', 'public, max-age=86400');

    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'DataDragon proxy error' });
  }
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('SERVER ERROR:', err);
  res.status(500).json({ error: err?.message ?? 'Server error' });
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
