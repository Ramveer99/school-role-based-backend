import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  seedTestSchoolData,
  apiRequest,
} from './testHelper.js';
import { getSentEmails } from '../src/services/emailService.js';

describe('Authentication & Password Management Tests', () => {
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

  test('POST /auth/login - Admin login succeeds and returns JWT and profile', async () => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: {
        email: seedData.adminA.profile.email,
        password: seedData.defaultPassword,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token, 'Should return JWT token');
    assert.equal(res.body.user.email, seedData.adminA.profile.email);
    assert.equal(res.body.user.role, 'admin');
  });

  test('POST /auth/login - Teacher login succeeds', async () => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: {
        email: seedData.teacherA.profile.email,
        password: seedData.defaultPassword,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'teacher');
  });

  test('POST /auth/login - Student login succeeds', async () => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: {
        email: seedData.studentA1.profile.email,
        password: seedData.defaultPassword,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'student');
  });

  test('POST /auth/login - Parent login succeeds', async () => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: {
        email: seedData.parentA1.profile.email,
        password: seedData.defaultPassword,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'parent');
  });

  test('POST /auth/login - Invalid credentials returns 401', async () => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: {
        email: seedData.adminA.profile.email,
        password: 'wrong-password-999',
      },
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error);
  });

  test('GET /auth/me - Rejects request with invalid or expired token', async () => {
    const res = await apiRequest('/auth/me', {
      token: 'invalid.jwt.token.string',
    });

    assert.equal(res.status, 401);
  });

  test('POST /auth/change-password - Validates current password and updates password', async () => {
    const token = seedData.studentA1.token;

    // 1. Wrong current password fails
    const badAttempt = await apiRequest('/auth/change-password', {
      method: 'POST',
      token,
      body: {
        currentPassword: 'wrong-current-pass',
        newPassword: 'BrandNewSecurePass@2026',
      },
    });
    assert.equal(badAttempt.status, 400);
    assert.match(badAttempt.body.error, /Current password is incorrect/i);

    // 2. Short new password fails
    const shortAttempt = await apiRequest('/auth/change-password', {
      method: 'POST',
      token,
      body: {
        currentPassword: seedData.defaultPassword,
        newPassword: '123',
      },
    });
    assert.equal(shortAttempt.status, 400);

    // 3. Successful password change
    const goodAttempt = await apiRequest('/auth/change-password', {
      method: 'POST',
      token,
      body: {
        currentPassword: seedData.defaultPassword,
        newPassword: 'BrandNewSecurePass@2026',
      },
    });
    assert.equal(goodAttempt.status, 200);
    assert.equal(goodAttempt.body.success, true);

    // 4. Verify login with old password now fails
    const oldLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: {
        email: seedData.studentA1.profile.email,
        password: seedData.defaultPassword,
      },
    });
    assert.equal(oldLogin.status, 401);

    // 5. Verify login with new password succeeds
    const newLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: {
        email: seedData.studentA1.profile.email,
        password: 'BrandNewSecurePass@2026',
      },
    });
    assert.equal(newLogin.status, 200);
    assert.ok(newLogin.body.token);
  });

  test('POST /auth/forgot-password & /auth/reset-password flow', async () => {
    // 1. Request reset
    const forgotRes = await apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: { email: seedData.teacherA.profile.email },
    });

    assert.equal(forgotRes.status, 200);
    assert.ok(forgotRes.body.ok);

    // Check sent emails log
    const emails = getSentEmails();
    const resetEmail = emails.find((e) => e.to === seedData.teacherA.profile.email);
    assert.ok(resetEmail, 'Password reset email should be queued/sent');
    assert.match(resetEmail.subject, /Password Reset/i);

    // In non-prod, resetToken is returned in payload or can be extracted from resetEmail
    const token = forgotRes.body.resetToken;
    assert.ok(token, 'Reset token should be present in non-production environment');

    // 2. Reset password with token
    const resetRes = await apiRequest('/auth/reset-password', {
      method: 'POST',
      body: {
        token,
        password: 'ResetTeacherPass@2026',
      },
    });

    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body.success, true);

    // 3. Verify login with new password
    const loginRes = await apiRequest('/auth/login', {
      method: 'POST',
      body: {
        email: seedData.teacherA.profile.email,
        password: 'ResetTeacherPass@2026',
      },
    });

    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.body.token);
  });
});
