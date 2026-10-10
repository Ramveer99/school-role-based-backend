import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, teardownTestEnvironment, seedTestSchoolData, apiRequest } from './testHelper.js';
import { Fee, Organization } from '../src/models/index.js';
import { OrganizationLedger } from '../src/models/OrganizationLedger.js';

describe('Organization ERP ledger', () => {
  let seed;
  before(setupTestEnvironment);
  after(teardownTestEnvironment);
  beforeEach(async () => { seed = await seedTestSchoolData(); });
  const base = () => `/organizations/${seed.schoolA.id}/ledger`;
  const request = (suffix = '', options = {}) => apiRequest(base() + suffix, { token: seed.superAdmin.token, ...options });
  const post = (suffix, body, options = {}) => request(suffix, { method: 'POST', body, ...options });
  const chargeBody = (amount = 1500000) => ({ amount_paise: amount, description: 'ERP access', service_from: '2026-04-01', service_to: '2026-06-30', due_date: '2026-04-10', date: '2026-04-01' });
  const paymentBody = (amount = 600000) => ({ amount_paise: amount, date: '2026-04-05', payment_method: 'Bank transfer', reference: 'BANK-001' });
  async function createCharge(amount) {
    const result = await post('/charges', chargeBody(amount));
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return result.body.entries[0].id;
  }

  test('charges, installments, advance credit and allocation calculate balances separately from student fees', async () => {
    const feesBefore = await Fee.countDocuments();
    assert.equal((await request()).body.total_charged_paise, 0);
    const chargeId = await createCharge();
    const first = await post('/payments', { ...paymentBody(), allocations: [{ charge_id: chargeId, amount_paise: 600000 }] });
    assert.equal(first.status, 201);
    assert.equal(first.body.summary.outstanding_paise, 900000);
    assert.equal(first.body.summary.available_credit_paise, 0);
    const payment = await post('/payments', paymentBody(1000000));
    assert.equal(payment.body.summary.available_credit_paise, 1000000);
    const allocation = await post(`/payments/${payment.body.entries[0].id}/allocations`, { allocations: [{ charge_id: chargeId, amount_paise: 900000 }] });
    assert.equal(allocation.status, 201);
    assert.equal(allocation.body.summary.outstanding_paise, 0);
    assert.equal(allocation.body.summary.available_credit_paise, 100000);
    assert.equal(allocation.body.summary.net_balance_paise, -100000);
    const charges = await request('/charges', { token: seed.adminA.token });
    assert.equal(charges.body.data[0].status, 'paid');
    assert.equal(charges.body.data[0].service_to, '2026-06-30');
    assert.equal(await Fee.countDocuments(), feesBefore);
    assert.equal((await Organization.findById(seed.schoolA.id)).active, true);
  });

  test('admins have school-scoped read-only access; other roles have no ledger access', async () => {
    for (const suffix of ['', '/charges', '/payments', '/entries']) {
      assert.equal((await request(suffix, { token: seed.adminA.token })).status, 200);
      for (const role of ['adminB', 'teacherA', 'studentA1', 'parentA1']) assert.equal((await request(suffix, { token: seed[role].token })).status, 403);
      assert.equal((await request(suffix, { token: null })).status, 401);
    }
    for (const suffix of ['/charges', '/payments', '/payments/000000000000000000000000/allocations', '/entries/000000000000000000000000/reverse']) {
      for (const role of ['adminA', 'adminB', 'teacherA', 'studentA1', 'parentA1']) {
        assert.equal((await post(suffix, {}, { token: seed[role].token })).status, 403);
      }
    }
    assert.equal((await apiRequest('/organizations/bad/ledger', { token: seed.superAdmin.token })).status, 400);
    assert.equal((await apiRequest('/organizations/000000000000000000000000/ledger', { token: seed.superAdmin.token })).status, 404);
  });

  test('validation, school isolation and over-allocation leave no partial payment entries', async () => {
    for (const amount of [0, -1, 1.2, '100', Number.MAX_SAFE_INTEGER + 1]) assert.equal((await post('/charges', chargeBody(amount))).status, 400);
    assert.equal((await post('/charges', { ...chargeBody(), service_to: '2026-02-30' })).status, 400);
    assert.equal((await post('/charges', { ...chargeBody(), service_to: '2025-01-01' })).status, 400);
    assert.equal((await post('/charges', { ...chargeBody(), organization_id: seed.schoolB.id })).status, 400);
    const chargeId = await createCharge(100);
    const invalid = await post('/payments', { ...paymentBody(200), allocations: [{ charge_id: chargeId, amount_paise: 101 }] });
    assert.equal(invalid.status, 400);
    assert.equal((await request('/payments')).body.total, 0);
    assert.equal((await post('/payments', { ...paymentBody(100), allocations: [{ charge_id: chargeId, amount_paise: 60 }, { charge_id: chargeId, amount_paise: 60 }] })).status, 400);
    const beta = await apiRequest(`/organizations/${seed.schoolB.id}/ledger/charges`, { method: 'POST', token: seed.superAdmin.token, body: chargeBody(100) });
    assert.equal((await post('/payments', { ...paymentBody(100), allocations: [{ charge_id: beta.body.entries[0].id, amount_paise: 100 }] })).status, 404);
    assert.equal((await request('/payments')).body.total, 0);
    assert.equal((await request('/entries?limit=101')).status, 400);
    assert.equal((await request('/entries?from=2026-02-30')).status, 400);
  });

  test('reversals preserve history and require releasing allocations first', async () => {
    const chargeId = await createCharge(100);
    const payment = await post('/payments', { ...paymentBody(100), allocations: [{ charge_id: chargeId, amount_paise: 100 }] });
    const paymentId = payment.body.entries[0].id;
    const allocationId = payment.body.entries[1].id;
    assert.equal((await post(`/entries/${paymentId}/reverse`, { reason: 'Incorrect payment' })).status, 409);
    assert.equal((await post(`/entries/${chargeId}/reverse`, { reason: 'Incorrect period' })).status, 409);
    assert.equal((await post(`/entries/${allocationId}/reverse`, {})).status, 400);
    const reversal = await post(`/entries/${allocationId}/reverse`, { reason: 'Reallocate payment' });
    assert.equal(reversal.status, 201);
    assert.equal(reversal.body.summary.outstanding_paise, 100);
    assert.equal(reversal.body.summary.available_credit_paise, 100);
    assert.equal((await post(`/entries/${allocationId}/reverse`, { reason: 'Again' })).status, 409);
    assert.equal((await post(`/entries/${reversal.body.entries[0].id}/reverse`, { reason: 'Again' })).status, 409);
    assert.equal((await post(`/entries/${paymentId}/reverse`, { reason: 'Incorrect payment' })).status, 201);
    assert.equal((await post(`/entries/${chargeId}/reverse`, { reason: 'Incorrect period' })).status, 201);
    const summary = await request();
    assert.equal(summary.body.total_charged_paise, 0);
    assert.equal(summary.body.total_received_paise, 0);
    const entries = (await request('/entries')).body;
    assert.equal(entries.total, 6);
    assert.ok(entries.data.every(e => e.created_by === seed.superAdmin.profile.id && e.created_at));
    assert.equal((await request('/charges')).body.data[0].status, 'reversed');
  });

  test('payment retries with Idempotency-Key do not duplicate records', async () => {
    const options = { headers: { 'Idempotency-Key': 'receipt-123' } };
    const first = await post('/payments', paymentBody(100), options);
    const retry = await post('/payments', paymentBody(100), options);
    assert.equal(retry.status, 201);
    assert.equal(retry.body.replayed, true);
    assert.equal(first.body.entries[0].id, retry.body.entries[0].id);
    assert.equal((await request('/payments')).body.total, 1);
    assert.equal((await post('/payments', paymentBody(200), options)).status, 409);
  });

  test('concurrent allocations cannot overspend credit or charge balances; listing filters and pagination work', async () => {
    const chargeId = await createCharge(100);
    const payment = await post('/payments', paymentBody(100));
    const suffix = `/payments/${payment.body.entries[0].id}/allocations`;
    const results = await Promise.all([1, 2].map(() => post(suffix, { date: '2026-04-05', allocations: [{ charge_id: chargeId, amount_paise: 80 }] })));
    assert.equal(results.filter(r => r.status === 201).length, 1);
    assert.ok(results.some(r => [400, 409].includes(r.status)));
    assert.equal((await request()).body.outstanding_paise, 20);
    assert.equal((await request()).body.available_credit_paise, 20);
    const page = await request('/entries?limit=1&page=2&from=2026-04-01&to=2026-04-30');
    assert.equal(page.body.total, 3);
    assert.equal(page.body.data.length, 1);
    assert.equal((await request('/charges?service_from=2026-05-01&service_to=2026-05-31')).body.total, 1);
    assert.equal((await request('/charges?service_from=2027-01-01')).body.total, 0);
    assert.equal(await OrganizationLedger.countDocuments({ organization_id: seed.schoolA.id }), 1);
  });
});
