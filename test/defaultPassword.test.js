import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, teardownTestEnvironment, seedTestSchoolData, apiRequest } from './testHelper.js';
import { OrganizationPasswordSetting } from '../src/models/OrganizationPasswordSetting.js';
import { User } from '../src/models/index.js';
import { getSentEmails } from '../src/services/emailService.js';

describe('School default passwords', () => {
  let seed;
  before(setupTestEnvironment);
  after(teardownTestEnvironment);
  beforeEach(async () => { seed = await seedTestSchoolData(); });
  const path = (school = seed.schoolA) => `/organizations/${school.id}/default-password`;
  const request = (url, options = {}) => apiRequest(url, { token: seed.adminA.token, ...options });
  const set = (password, options = {}) => request(path(), { method: 'PUT', body: { default_password: password }, ...options });
  const login = (email, password) => apiRequest('/auth/login', { method: 'POST', body: { email, password } });

  test('school defaults are stable, encrypted, restricted, and absent from normal responses', async () => {
    const first = await request(path());
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('cache-control'), 'no-store');
    assert.ok(first.body.default_password.length >= 8);
    assert.equal((await request(path())).body.default_password, first.body.default_password);
    assert.equal((await request(path(), { token: seed.superAdmin.token })).body.default_password, first.body.default_password);
    const second = await request(path(seed.schoolB), { token: seed.superAdmin.token });
    assert.notEqual(second.body.default_password, first.body.default_password);
    for (const method of ['GET', 'PUT']) {
      for (const role of ['teacherA', 'studentA1', 'parentA1', 'adminB']) {
        assert.equal((await request(path(), { method, token: seed[role].token, body: method === 'PUT' ? { default_password: 'SchoolPass123!' } : undefined })).status, 403);
      }
      assert.equal((await request(path(), { method, token: null })).status, 401);
    }
    assert.equal((await request('/organizations/bad/default-password')).status, 400);
    assert.equal((await request('/organizations/000000000000000000000000/default-password', { token: seed.superAdmin.token })).status, 404);
    assert.equal((await set('SchoolPass123!')).status, 200);
    const stored = await OrganizationPasswordSetting.findOne({ organization_id: seed.schoolA.id }).select('+encrypted_password');
    assert.ok(stored.encrypted_password);
    assert.ok(!JSON.stringify(stored).includes('SchoolPass123!'));
    for (const url of ['/organizations', `/organizations/${seed.schoolA.id}`, '/auth/me']) {
      const response = await request(url, { token: seed.superAdmin.token });
      assert.equal(response.status, 200);
      assert.ok(!JSON.stringify(response.body).includes('SchoolPass123!'));
      assert.ok(!JSON.stringify(response.body).includes('encrypted_password'));
    }
    // Generic school updates must not change the protected setting.
    await request(`/organizations/${seed.schoolA.id}`, { method: 'PUT', body: { default_password: 'InjectedPass!', encrypted_password: 'bad' } });
    assert.equal((await request(path())).body.default_password, 'SchoolPass123!');
    for (const password of ['', 'short', '        ', 'x'.repeat(73), 'é'.repeat(37), '$2b$10$fakehash', 123, null]) {
      assert.equal((await set(password)).status, 400);
    }
    assert.equal((await request(path())).body.default_password, 'SchoolPass123!');
    assert.equal((await request(path(seed.schoolB), { token: seed.superAdmin.token })).body.default_password, second.body.default_password);
  });

  test('all creation paths use the school default, preserving explicit supported passwords and existing accounts', async () => {
    const password = 'SchoolPass123!';
    await set(password);
    const cases = [
      ['/teachers', { full_name: 'Teacher', email: 'new.teacher@example.com', employee_id: 'T-new' }],
      ['/parents', { full_name: 'Parent', email: 'new.parent@example.com' }],
      ['/students', { full_name: 'Student', email: 'new.student@example.com', admission_no: 'S-new', parent: { full_name: 'Guardian', email: 'guardian@example.com' } }],
      ['/auth/register', { full_name: 'Registered', email: 'registered@example.com', role: 'teacher' }],
      [`/organizations/${seed.schoolA.id}/teachers`, { full_name: 'Nested', email: 'nested@example.com', employee_id: 'T-nested' }],
    ];
    for (const [url, body] of cases) {
      const created = await request(url, { method: 'POST', body, token: url.startsWith('/organizations') ? seed.superAdmin.token : seed.adminA.token });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal((await login(body.email, password)).status, 200);
      const user = await User.findOne({ email: body.email }).select('+password');
      assert.notEqual(user.password, password);
    }
    assert.equal((await login('guardian@example.com', password)).status, 200);
    const admitted = await request('/admissions', { method: 'POST', body: {
      student: { full_name: 'Admitted', email: 'admitted@example.com', admission_no: 'AD-new' },
      parent: { full_name: 'Admission Parent', email: 'admission.parent@example.com' },
    } });
    assert.equal(admitted.status, 201);
    for (const email of ['admitted@example.com', 'admission.parent@example.com']) {
      assert.equal((await login(email, password)).status, 200);
      assert.ok(getSentEmails().some(mail => mail.to === email && mail.html.includes(password)));
    }
    const explicit = await request('/teachers', { method: 'POST', body: { full_name: 'Explicit', email: 'explicit@example.com', employee_id: 'T-explicit', password: 'CustomPass123!' } });
    assert.equal(explicit.status, 201);
    assert.equal((await login('explicit@example.com', 'CustomPass123!')).status, 200);
    assert.equal((await set('NextSchoolPass123!', { token: seed.superAdmin.token })).status, 200);
    assert.equal((await login('new.teacher@example.com', password)).status, 200);
    assert.equal((await login(seed.parentA1.profile.email, seed.defaultPassword)).status, 200);
    const next = await request('/parents', { method: 'POST', body: { full_name: 'Next', email: 'next@example.com' } });
    assert.equal(next.status, 201);
    assert.equal((await login('next@example.com', 'NextSchoolPass123!')).status, 200);
  });

  test('new organization admin and school-B members use their own school defaults', async () => {
    const created = await request('/organizations', { method: 'POST', token: seed.superAdmin.token, body: { name: 'New School', code: 'NEW', admin_name: 'New Admin', admin_email: 'school.admin@example.com' } });
    assert.equal(created.status, 201);
    const setting = await request(`/organizations/${created.body.id}/default-password`, { token: seed.superAdmin.token });
    assert.equal((await login('school.admin@example.com', setting.body.default_password)).status, 200);
    await request(path(seed.schoolB), { method: 'PUT', token: seed.superAdmin.token, body: { default_password: 'BetaSchoolPass123!' } });
    const teacher = await request(`/organizations/${seed.schoolB.id}/teachers`, { method: 'POST', token: seed.superAdmin.token, body: { full_name: 'Beta Teacher', email: 'beta.teacher@example.com', employee_id: 'B-new' } });
    assert.equal(teacher.status, 201);
    assert.equal((await login('beta.teacher@example.com', 'BetaSchoolPass123!')).status, 200);
  });
});
