import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment, teardownTestEnvironment, seedTestSchoolData, apiRequest } from './testHelper.js';
import { Organization, User, Profile } from '../src/models/index.js';

describe('Organization admin email responses', () => {
  before(setupTestEnvironment);
  after(teardownTestEnvironment);
  test('list and detail expose the linked login email, preserve school email, and handle missing/multiple admins', async () => {
    const seed = await seedTestSchoolData();
    await Organization.findByIdAndUpdate(seed.schoolA.id, { email: 'contact@school.example' });
    await User.findByIdAndUpdate(seed.adminA.profile.user_id, { email: 'updated.admin@example.com' });
    const extraUser = await User.create({ email: 'second.admin@example.com', password: 'Example123!' });
    await Profile.create({ user_id: extraUser.id, email: extraUser.email, full_name: 'Second Admin', role: 'admin', organization_id: seed.schoolA.id });
    const empty = await Organization.create({ name: 'No Admin', code: 'NOADMIN' });
    const list = await apiRequest('/organizations', { token: seed.superAdmin.token });
    assert.equal(list.status, 200);
    const schoolA = list.body.find(org => org.id === seed.schoolA.id);
    assert.equal(schoolA.admin_email, 'updated.admin@example.com');
    assert.equal(schoolA.email, 'contact@school.example');
    assert.equal(list.body.find(org => org.id === seed.schoolB.id).admin_email, seed.adminB.profile.email);
    assert.equal(list.body.find(org => org.id === empty.id).admin_email, null);
    for (const token of [seed.adminA.token, seed.superAdmin.token]) {
      const detail = await apiRequest(`/organizations/${seed.schoolA.id}`, { token });
      assert.equal(detail.status, 200);
      assert.equal(detail.body.admin_email, schoolA.admin_email);
      assert.deepEqual(detail.body.stats, schoolA.stats);
    }
    assert.equal((await apiRequest(`/organizations/${empty.id}`, { token: seed.superAdmin.token })).body.admin_email, null);
    assert.equal((await apiRequest(`/organizations/${seed.schoolA.id}`, { token: seed.adminB.token })).status, 403);
  });
});
