import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  seedTestSchoolData,
  apiRequest,
} from './testHelper.js';

describe('Role-Based Access & Multi-Tenant Isolation Tests', () => {
  let seedData;

  before(async () => {
    await setupTestEnvironment();
  });

  after(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    seedData = await seedTestSchoolData();
  });

  test('Organization Isolation - Admin Alpha cannot access or modify School Beta class', async () => {
    const adminAToken = seedData.adminA.token;
    const betaClassId = seedData.classB._id.toString();

    // Admin Alpha tries to get School Beta's class
    const getRes = await apiRequest(`/classes/${betaClassId}`, {
      token: adminAToken,
    });
    assert.equal(getRes.status, 403, 'Admin Alpha must not view School Beta class');

    // Admin Alpha tries to update School Beta's class
    const putRes = await apiRequest(`/classes/${betaClassId}`, {
      method: 'PUT',
      token: adminAToken,
      body: { grade: '12' },
    });
    assert.equal(putRes.status, 404, 'Admin Alpha must not update School Beta class');
  });

  test('Role Authorization - Teacher and Student cannot access Super Admin endpoints', async () => {
    const teacherToken = seedData.teacherA.token;
    const studentToken = seedData.studentA1.token;

    // Teacher tries to list all organizations
    const teacherRes = await apiRequest('/organizations', {
      token: teacherToken,
    });
    assert.equal(teacherRes.status, 403);

    // Student tries to list all organizations
    const studentRes = await apiRequest('/organizations', {
      token: studentToken,
    });
    assert.equal(studentRes.status, 403);
  });

  test('Parent-Child Isolation - Parent P1 can access child S1, but receives 403 for child S2', async () => {
    const parentToken = seedData.parentA1.token;
    const childS1Id = seedData.studentA1Doc._id.toString();
    const otherChildS2Id = seedData.studentA2Doc._id.toString();

    // 1. Parent can access their linked child S1
    const allowedRes = await apiRequest(`/students/${childS1Id}`, {
      token: parentToken,
    });
    assert.equal(allowedRes.status, 200);
    assert.equal(allowedRes.body.full_name, 'Student One');

    // 2. Parent is blocked from accessing unlinked child S2
    const blockedRes = await apiRequest(`/students/${otherChildS2Id}`, {
      token: parentToken,
    });
    assert.equal(blockedRes.status, 403, 'Parent must be forbidden from accessing unlinked student');
    assert.match(blockedRes.body.error, /only access your own children/i);

    // 3. Parent listing students sees ONLY linked children
    const listRes = await apiRequest('/students', {
      token: parentToken,
    });
    assert.equal(listRes.status, 200);
    assert.equal(Array.isArray(listRes.body), true);
    assert.equal(listRes.body.length, 1);
    assert.equal(listRes.body[0].id, childS1Id);
  });

  test('Student-Self Isolation - Student S1 can access own profile, but receives 403 for S2', async () => {
    const student1Token = seedData.studentA1.token;
    const s1Id = seedData.studentA1Doc._id.toString();
    const s2Id = seedData.studentA2Doc._id.toString();

    // 1. Student S1 can access own student details
    const selfRes = await apiRequest(`/students/${s1Id}`, {
      token: student1Token,
    });
    assert.equal(selfRes.status, 200);
    assert.equal(selfRes.body.admission_no, 'STU-A-001');

    // 2. Student S1 is forbidden from accessing S2
    const otherRes = await apiRequest(`/students/${s2Id}`, {
      token: student1Token,
    });
    assert.equal(otherRes.status, 403, 'Student must not view another student details');
    assert.match(otherRes.body.error, /Cannot access other student profiles/i);

    // 3. Student listing /students returns only their own record
    const listRes = await apiRequest('/students', {
      token: student1Token,
    });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.length, 1);
    assert.equal(listRes.body[0].id, s1Id);
  });

  test('Parent Isolation - Parent cannot browse other parents in the school', async () => {
    const parentToken = seedData.parentA1.token;
    const myParentId = seedData.parentA1Doc._id.toString();

    const listRes = await apiRequest('/parents', {
      token: parentToken,
    });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.length, 1);
    assert.equal(listRes.body[0].id, myParentId);
  });
});
