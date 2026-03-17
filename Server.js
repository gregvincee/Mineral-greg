const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

const EBAY_APP_ID = 'Vincentg-GREG-PRD-c2b57c9de-c28557ae';
const EBAY_URL = 'https://svcs.ebay.com/services/search/FindingService/v1';

app.get('/api/ebay-price', async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: 'query requis' });

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
    const r = await fetch(`${EBAY_URL}?${params}`);
    const data = await r.json();
    const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];

    if (!items.length) return res.json({ found: false });

    const prices = items
      .map(i => parseFloat(i?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0))
      .filter(p => p > 0)
      .sort((a, b) => a - b);

    const mid = Math.floor(prices.length / 2);
    const median = prices.length % 2 !== 0
      ? prices[mid]
      : (prices[mid - 1] + prices[mid]) / 2;

    res.json({
      found: true,
      median: +median.toFixed(2),
      low: +prices[0].toFixed(2),
      high: +prices[prices.length - 1].toFixed(2),
      count: prices.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Mineral API → port ${PORT}`));
