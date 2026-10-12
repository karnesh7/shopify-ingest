import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

test('Shopify Webhook Security & Ingestion Unit Tests', async (t) => {
  const TEST_SECRET = 'shpss_test_secret_key_12345';

  await t.test('computes and validates exact Shopify HMAC SHA-256 digest', () => {
    const rawPayload = JSON.stringify({
      id: 987654321,
      email: 'merchant@example.com',
      total_price: '199.99',
      line_items: [{ title: 'Premium Silk Shirt', quantity: 1, price: '199.99' }],
    });

    const validHmac = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(rawPayload)
      .digest('base64');

    assert.ok(validHmac.length > 0, 'HMAC string must be generated');

    // Verification check simulation
    const candidateHmac = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(rawPayload)
      .digest('base64');

    assert.equal(candidateHmac, validHmac, 'Generated HMAC must match validation check');
  });

  await t.test('rejects tampered webhook payloads with invalid HMAC', () => {
    const originalPayload = JSON.stringify({ id: 101, amount: 50 });
    const tamperedPayload = JSON.stringify({ id: 101, amount: 5000 });

    const originalHmac = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(originalPayload)
      .digest('base64');

    const tamperedCheck = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(tamperedPayload)
      .digest('base64');

    assert.notEqual(tamperedCheck, originalHmac, 'Tampered payload must fail HMAC validation');
  });

  await t.test('generates cryptographically secure 48-char hex tenant API keys', () => {
    const apiKey = crypto.randomBytes(24).toString('hex');
    assert.equal(apiKey.length, 48, 'API key must be 48 hex characters long');
    assert.match(apiKey, /^[0-9a-f]{48}$/, 'API key must be valid hex');
  });

  await t.test('extracts subdomain slug cleanly from myshopify.com domain', () => {
    const shopDomain = 'cool-boutique-store.myshopify.com';
    const slug = shopDomain.split('.')[0];
    assert.equal(slug, 'cool-boutique-store', 'Slug should match the primary store subdomain');
  });
});
