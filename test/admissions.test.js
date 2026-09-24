import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  seedTestSchoolData,
  apiRequest,
} from './testHelper.js';
import { User, Student, Parent, StudentParent, ClassModel } from '../src/models/index.js';
import { getSentEmails } from '../src/services/emailService.js';

describe('Student Admission Flow & Credential Tests', () => {
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

  test('POST /admissions - Full admission creates records, user accounts, and dispatches credentials', async () => {
    const adminToken = seedData.adminA.token;

    const payload = {
      student: {
        full_name: 'Devansh Roy',
        admission_no: 'ADM-2026-901',
        email: 'devansh.r@schoolalpha.edu',
        roll_no: '22',
        class_grade: '10',
        section: 'B',
        gender: 'Male',
        dob: '2010-08-14',
        phone: '+91 91234 56789',
        address: '88 Cyber City, Alpha',
      },
      parent: {
        full_name: 'Anirudh Roy',
        email: 'anirudh.roy@example.com',
        phone: '+91 91234 00000',
        occupation: 'Surgeon',
        address: '88 Cyber City, Alpha',
      },
    };

    const res = await apiRequest('/admissions', {
      method: 'POST',
      token: adminToken,
      body: payload,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.student);
    assert.equal(res.body.student.full_name, 'Devansh Roy');
    assert.equal(res.body.student.admission_no, 'ADM-2026-901');

    // Security check: passwords MUST NOT be returned in API response
    assert.equal(res.body.studentPassword, undefined);
    assert.equal(res.body.parentPassword, undefined);
    assert.equal(res.body.password, undefined);

    // 1. Verify DB Student record
    const studentDoc = await Student.findOne({ admission_no: 'ADM-2026-901' });
    assert.ok(studentDoc, 'Student document should be created');
    assert.equal(studentDoc.organization_id.toString(), seedData.schoolA._id.toString());

    // 2. Verify Student User account created with HASHED password
    const studentUser = await User.findOne({ email: 'devansh.r@schoolalpha.edu' }).select('+password');
    assert.ok(studentUser, 'Student user account should be created');
    assert.match(studentUser.password, /^\$2[aby]\$\d+\$/, 'Password must be bcrypt hashed');

    // 3. Verify Parent record created
    const parentDoc = await Parent.findOne({ email: 'anirudh.roy@example.com' });
    assert.ok(parentDoc, 'Parent document should be created');

    // 4. Verify Parent User account created with HASHED password
    const parentUser = await User.findOne({ email: 'anirudh.roy@example.com' }).select('+password');
    assert.ok(parentUser, 'Parent user account should be created');
    assert.match(parentUser.password, /^\$2[aby]\$\d+\$/, 'Parent password must be bcrypt hashed');

    // 5. Verify StudentParent link
    const link = await StudentParent.findOne({
      student_id: studentDoc._id,
      parent_id: parentDoc._id,
    });
    assert.ok(link, 'StudentParent relationship must be established');

    // 6. Verify Class created
    const classDoc = await ClassModel.findOne({
      organization_id: seedData.schoolA._id,
      grade: '10',
      section: 'B',
    });
    assert.ok(classDoc, 'Class 10-B should be automatically created');

    // 7. Verify Credentials sent by email
    const emails = getSentEmails();
    const studentEmail = emails.find((e) => e.to === 'devansh.r@schoolalpha.edu');
    assert.ok(studentEmail, 'Student credentials email must be sent');
    assert.match(studentEmail.subject, /Student Login Credentials/i);

    const parentEmail = emails.find((e) => e.to === 'anirudh.roy@example.com');
    assert.ok(parentEmail, 'Parent credentials email must be sent');
    assert.match(parentEmail.subject, /Parent Portal Account/i);

    // 8. Verify the student can log in using the temporary password sent in email
    const match = studentEmail.html.match(/Temporary Password:<\/strong>\s*<span[^>]*>([^<]+)<\/span>/);
    assert.ok(match && match[1], 'Temporary password should be present in student email');
    const studentTempPass = match[1].trim();

    const studentLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: {
        email: 'devansh.r@schoolalpha.edu',
        password: studentTempPass,
      },
    });
    assert.equal(studentLogin.status, 200, 'Student must be able to log in with temporary password');
    assert.equal(studentLogin.body.user.role, 'student');
  });

  test('POST /admissions - Sibling admission links to existing parent', async () => {
    const adminToken = seedData.adminA.token;
    const existingParentId = seedData.parentA1Doc._id.toString();

    const payload = {
      student: {
        full_name: 'Sibling Student',
        admission_no: 'ADM-2026-902',
        email: 'sibling.student@schoolalpha.edu',
        class_grade: '10',
        section: 'A',
      },
      parent_id: existingParentId,
    };

    const res = await apiRequest('/admissions', {
      method: 'POST',
      token: adminToken,
      body: payload,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.parent_id, existingParentId);

    // Verify link created between new student and existing parent
    const studentDoc = await Student.findOne({ admission_no: 'ADM-2026-902' });
    const link = await StudentParent.findOne({
      student_id: studentDoc._id,
      parent_id: existingParentId,
    });
    assert.ok(link, 'Link to existing parent must be created');
  });

  test('POST /admissions - Duplicate admission number is rejected with 409', async () => {
    const adminToken = seedData.adminA.token;

    const payload = {
      student: {
        full_name: 'Duplicate Number Candidate',
        admission_no: 'STU-A-001', // Already belongs to Student One
        email: 'unique.candidate@schoolalpha.edu',
      },
      parent: {
        full_name: 'Parent Two',
        email: 'parent.two@example.com',
      },
    };

    const res = await apiRequest('/admissions', {
      method: 'POST',
      token: adminToken,
      body: payload,
    });

    assert.equal(res.status, 409);
    assert.match(res.body.error, /already exists in this organization/i);
  });

  test('POST /admissions - Duplicate student email is rejected with 409', async () => {
    const adminToken = seedData.adminA.token;

    const payload = {
      student: {
        full_name: 'Duplicate Email Candidate',
        admission_no: 'ADM-UNIQUE-123',
        email: seedData.studentA1.profile.email, // Already registered
      },
      parent: {
        full_name: 'Parent Unique',
        email: 'parent.unique@example.com',
      },
    };

    const res = await apiRequest('/admissions', {
      method: 'POST',
      token: adminToken,
      body: payload,
    });

    assert.equal(res.status, 409);
    assert.match(res.body.error, /already exists/i);
  });

  test('POST /admissions - Non-admin cannot perform admission', async () => {
    const teacherToken = seedData.teacherA.token;

    const res = await apiRequest('/admissions', {
      method: 'POST',
      token: teacherToken,
      body: {
        student: { full_name: 'Test', admission_no: 'TEST-1', email: 'test@school.edu' },
      },
    });

    assert.equal(res.status, 403);
  });
});
