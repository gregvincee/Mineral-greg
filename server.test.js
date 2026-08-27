const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePriceSummary, normalizeQuery } = require('./server');

test('calcule des prix valides sans exposer les entrées invalides', () => {
  const summary = calculatePriceSummary([
    { sellingStatus: [{ currentPrice: [{ __value__: '12.50' }] }] },
    { sellingStatus: [{ currentPrice: [{ __value__: '7.00' }] }] },
    { sellingStatus: [{ currentPrice: [{ __value__: '20.00' }] }] },
    { sellingStatus: [{ currentPrice: [{ __value__: 'invalide' }] }] },
  ]);
  assert.deepEqual(summary, { found: true, median: 12.5, low: 7, high: 20, count: 3 });
});

test('refuse les requêtes absentes, trop courtes ou trop longues', () => {
  assert.equal(normalizeQuery('  carte   hockey  '), 'carte hockey');
  assert.equal(normalizeQuery('x'), null);
  assert.equal(normalizeQuery('x'.repeat(121)), null);
  assert.equal(normalizeQuery(undefined), null);
});
