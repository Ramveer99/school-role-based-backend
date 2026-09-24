import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, teardownTestEnvironment, apiRequest } from './testHelper.js';

describe('Swagger Documentation Endpoints', () => {
  before(async () => {
    await setupTestEnvironment();
  });

  after(async () => {
    await teardownTestEnvironment();
  });

  test('GET /api/docs.json - Returns valid OpenAPI 3.0 specification', async () => {
    const res = await apiRequest('/docs.json');
    assert.equal(res.status, 200);
    assert.equal(res.body.openapi, '3.0.3');
    assert.ok(res.body.paths['/auth/login']);
    assert.ok(res.body.paths['/admissions']);
    assert.ok(res.body.paths['/auth/change-password']);
    assert.ok(res.body.paths['/students']);
    assert.ok(res.body.paths['/teachers']);
    assert.ok(res.body.paths['/parents']);
    assert.ok(res.body.paths['/classes']);
    assert.ok(res.body.paths['/organizations']);
    assert.ok(res.body.paths['/notices']);
  });

  test('GET /api/docs - Serves Swagger UI HTML page', async () => {
    const res = await apiRequest('/docs/');
    assert.equal(res.status, 200);
    assert.match(String(res.body), /swagger-ui/i);
  });
});
