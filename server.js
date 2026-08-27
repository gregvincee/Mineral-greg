const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const MAX_QUERY_LENGTH = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitByIp = new Map();
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET'],
  maxAge: 86_400,
}));

const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_URL = 'https://svcs.ebay.com/services/search/FindingService/v1';

function calculatePriceSummary(items) {
  const prices = items
    .map((item) => Number.parseFloat(item?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0'))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((left, right) => left - right);

  if (!prices.length) return { found: false };
  const middle = Math.floor(prices.length / 2);
  const median = prices.length % 2 !== 0
    ? prices[middle]
    : (prices[middle - 1] + prices[middle]) / 2;
  return {
    found: true,
    median: +median.toFixed(2),
    low: +prices[0].toFixed(2),
    high: +prices[prices.length - 1].toFixed(2),
    count: prices.length,
  };
}

function normalizeQuery(value) {
  if (typeof value !== 'string') return null;
  const query = value.trim().replace(/\s+/g, ' ');
  if (query.length < 2 || query.length > MAX_QUERY_LENGTH) return null;
  return query;
}

function priceRateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || 'unknown';
  const current = rateLimitByIp.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitByIp.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1_000)));
    return res.status(429).json({ error: 'trop de requêtes, réessayez bientôt' });
  }
  current.count += 1;
  return next();
}

app.get('/api/ebay-price', priceRateLimit, async (req, res) => {
  const query = normalizeQuery(req.query.query);
  if (!query) return res.status(400).json({ error: `query requis (2 à ${MAX_QUERY_LENGTH} caractères)` });
  if (!EBAY_APP_ID) return res.status(503).json({ error: 'service de prix indisponible' });

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': EBAY_APP_ID,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'keywords': query,
    'categoryId': '212',
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'sortOrder': 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '10',
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const r = await fetch(`${EBAY_URL}?${params}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!r.ok) throw new Error(`eBay a répondu ${r.status}`);
    const data = await r.json();
    const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];

    res.json(calculatePriceSummary(items));
  } catch (error) {
    console.error('Échec de la récupération eBay', error instanceof Error ? error.message : error);
    res.status(502).json({ error: 'service de prix temporairement indisponible' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

if (require.main === module) {
  const port = process.env.PORT;
  if (!port) throw new Error('PORT doit être défini avant de démarrer l’API.');
  app.listen(port, () => console.log(`Mineral API → port ${port}`));
}

module.exports = { app, calculatePriceSummary, normalizeQuery };
