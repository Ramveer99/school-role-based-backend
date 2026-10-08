import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, teardownTestEnvironment, seedTestSchoolData, apiRequest } from './testHelper.js';
import { Profile, User, StudentParent } from '../src/models/index.js';

describe('Super-admin organization member APIs', () => {
  let seed;
  before(setupTestEnvironment);
  after(teardownTestEnvironment);
  beforeEach(async () => { seed = await seedTestSchoolData(); });
  const request = (path, options = {}) => apiRequest(path, { token: seed.superAdmin.token, ...options });
  const base = (school = seed.schoolA) => `/organizations/${school.id}`;

  test('school lists and details preserve response shape and exclude other schools', async () => {
    for (const [resource, doc] of [['students', 'studentA1Doc'], ['teachers', 'teacherADoc'], ['parents', 'parentA1Doc']]) {
      const list = await request(`${base()}/${resource}`);
      assert.equal(list.status, 200);
      assert.ok(list.body.some(row => row.id === seed[doc].id));
      assert.ok(list.body.every(row => row.organization_id === seed.schoolA.id));
      assert.deepEqual((await request(`${base(seed.schoolB)}/${resource}`)).body, []);
      assert.equal((await request(`${base()}/${resource}/${seed[doc].id}`)).status, 200);
      for (const method of ['GET', 'PUT', 'DELETE']) {
        assert.equal((await request(`${base(seed.schoolB)}/${resource}/${seed[doc].id}`, { method, body: method === 'PUT' ? { full_name: 'Wrong school' } : undefined })).status, 404);
      }
    }
    assert.equal((await request(base(), { token: seed.adminA.token })).status, 200);
  });

  test('only super-admin can access any member route', async () => {
    for (const resource of ['students', 'teachers', 'parents']) {
      for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
        const path = `${base()}/${resource}${['PUT', 'DELETE'].includes(method) ? `/${seed.studentA1Doc.id}` : ''}`;
        assert.equal((await request(path, { method, token: null })).status, 401);
        for (const role of ['adminA', 'teacherA', 'studentA1', 'parentA1']) {
          assert.equal((await request(path, { method, token: seed[role].token })).status, 403);
        }
      }
    }
  });

  test('invalid IDs, forged account links and cross-school relationships are rejected', async () => {
    assert.equal((await request('/organizations/bad/students')).status, 400);
    assert.equal((await request('/organizations/000000000000000000000000/students')).status, 404);
    assert.equal((await request(`${base()}/students/bad`)).status, 400);
    for (const body of [{ organization_id: seed.schoolB.id }, { profile_id: seed.adminA.profile.id }, { $set: { full_name: 'Injected' } }, { teacher_id: '000000000000000000000000' }]) {
      assert.equal((await request(`${base()}/students/${seed.studentA1Doc.id}`, { method: 'PUT', body })).status, 400);
    }
    assert.equal((await request(`${base(seed.schoolB)}/students`, { method: 'POST', body: { full_name: 'New', email: 'new@example.com', admission_no: 'N1', parent_id: seed.parentA1Doc.id } })).status, 400);
    assert.equal((await request(`${base(seed.schoolB)}/parents`, { method: 'POST', body: { full_name: 'Hijack', email: seed.parentA1.profile.email } })).status, 409);
    assert.equal((await Profile.findById(seed.parentA1.profile.id)).organization_id.toString(), seed.schoolA.id);
  });

  test('create, edit login credentials, and delete each member type using the selected school', async () => {
    for (const [resource, extra] of [['teachers', { employee_id: 'NEW-T' }], ['parents', {}], ['students', { admission_no: 'NEW-S', parent_id: seed.parentA1Doc.id }]]) {
      const email = `new-${resource}@example.com`;
      const created = await request(`${base()}/${resource}`, { method: 'POST', body: { full_name: 'New Member', email, ...extra } });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const member = created.body.student || created.body.parent || created.body;
      assert.equal(member.organization_id, seed.schoolA.id);
      const profile = await Profile.findById(member.profile_id);
      assert.equal(profile.organization_id.toString(), seed.schoolA.id);
      const updatedEmail = `edited-${email}`;
      const updated = await request(`${base()}/${resource}/${member.id}`, { method: 'PUT', body: { email: updatedEmail, full_name: 'Edited Member', password: 'UpdatedPass123!' } });
      assert.equal(updated.status, 200);
      const login = await apiRequest('/auth/login', { method: 'POST', body: { email: updatedEmail, password: 'UpdatedPass123!' } });
      assert.equal(login.status, 200);
      assert.equal((await request(`${base()}/${resource}/${member.id}`, { method: 'DELETE' })).status, 200);
      assert.equal((await request(`${base()}/${resource}/${member.id}`)).status, 404);
      // Preserve legacy record deletion behavior: account deletion is a separate concern.
      assert.ok(await User.exists({ _id: profile.user_id }));
      if (resource === 'students') assert.equal(await StudentParent.countDocuments({ student_id: member.id }), 0);
    }
  });
});
