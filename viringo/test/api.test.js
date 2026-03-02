/**
 * Critical-path API tests: GET /spawns, POST /catch.
 * Run: NODE_ENV=test node --test test/api.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';

describe('GET /spawns', () => {
  it('returns 400 when lat/lng missing', async () => {
    const res = await request(app).get('/spawns');
    assert.strictEqual(res.status, 400);
    assert.ok(res.body?.error);
  });

  it('returns 400 when lat is not a number', async () => {
    const res = await request(app).get('/spawns').query({ lat: 'x', lng: '-75.16' });
    assert.strictEqual(res.status, 400);
  });

  it('returns 200 and array of spawns with valid lat/lng', async () => {
    const res = await request(app)
      .get('/spawns')
      .query({ lat: 39.9523, lng: -75.1638, radius: 1 });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    // May be empty or populated; each item should have expected shape if present
    if (res.body.length > 0) {
      const first = res.body[0];
      assert.ok('id' in first && 'creature_id' in first && 'lat' in first && 'lng' in first);
    }
  });
});

describe('POST /catch', () => {
  const testUserId = 'test-user-api-' + Date.now();

  it('returns 400 when spawn_id and creature_id missing', async () => {
    const res = await request(app)
      .post('/catch')
      .set('X-User-Id', testUserId)
      .send({});
    assert.strictEqual(res.status, 400);
    assert.ok(res.body?.error);
  });

  it('returns 201 and creature when given valid creature_id', async () => {
    // Use creature_id only (no spawn_id) so we don't depend on spawns table FK
    const res = await request(app)
      .post('/catch')
      .set('X-User-Id', testUserId)
      .send({ creature_id: 'grove-shell', lat: 39.95, lng: -75.16 });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body?.creature?.id);
    assert.ok('coins' in res.body || res.body.creature);
  });
});

describe('Integration: spawns then catch', () => {
  const uid = 'e2e-user-' + Date.now();

  it('GET /spawns returns array, then POST /catch with creature_id succeeds', async () => {
    const spawnRes = await request(app)
      .get('/spawns')
      .query({ lat: 39.9523, lng: -75.1638 })
      .set('X-User-Id', uid);
    assert.strictEqual(spawnRes.status, 200);
    assert.ok(Array.isArray(spawnRes.body));

    const catchRes = await request(app)
      .post('/catch')
      .set('X-User-Id', uid)
      .send({ creature_id: 'ember-fox', lat: 39.95, lng: -75.16 });
    assert.strictEqual(catchRes.status, 201);
    assert.strictEqual(catchRes.body?.creature?.id, 'ember-fox');
  });
});
