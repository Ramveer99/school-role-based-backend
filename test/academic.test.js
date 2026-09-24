import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  seedTestSchoolData,
  apiRequest,
} from './testHelper.js';

describe('Priority 3 Academic, Fees, & Dashboard Integration Tests', () => {
  let ctx = null;

  before(async () => {
    await setupTestEnvironment();
  });

  after(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    ctx = await seedTestSchoolData();
  });

  describe('Attendance Workflow', () => {
    it('Admin and Teacher can batch mark attendance; Student and Parent cannot', async () => {
      // 1. Batch mark by Teacher
      const batchRes = await apiRequest('/attendance', {
        method: 'POST',
        token: ctx.teacherA.token,
        body: {
          class_grade: '10',
          section: 'A',
          date: '2026-09-24',
          records: [
            { student_id: ctx.studentA1Doc._id.toString(), status: 'present', remarks: 'Present' },
            { student_id: ctx.studentA2Doc._id.toString(), status: 'absent', remarks: 'Sick leave' },
          ],
        },
      });

      assert.equal(batchRes.status, 200);
      assert.equal(batchRes.body.success, true);

      // 2. Student cannot mark attendance
      const studentAttempt = await apiRequest('/attendance', {
        method: 'POST',
        token: ctx.studentA1.token,
        body: {
          student_id: ctx.studentA1Doc._id.toString(),
          class_grade: '10',
          section: 'A',
          date: '2026-09-24',
          status: 'present',
        },
      });
      assert.equal(studentAttempt.status, 403);

      // 3. Parent cannot mark attendance
      const parentAttempt = await apiRequest('/attendance', {
        method: 'POST',
        token: ctx.parentA1.token,
        body: {
          student_id: ctx.studentA1Doc._id.toString(),
          class_grade: '10',
          section: 'A',
          date: '2026-09-24',
          status: 'present',
        },
      });
      assert.equal(parentAttempt.status, 403);
    });

    it('Enforces access control on viewing attendance and stats', async () => {
      // Mark attendance for both students
      await apiRequest('/attendance', {
        method: 'POST',
        token: ctx.adminA.token,
        body: {
          class_grade: '10',
          section: 'A',
          date: '2026-09-24',
          records: [
            { student_id: ctx.studentA1Doc._id.toString(), status: 'present' },
            { student_id: ctx.studentA2Doc._id.toString(), status: 'absent' },
          ],
        },
      });

      // Admin views stats
      const statsRes = await apiRequest('/attendance/stats?class_grade=10&section=A', {
        token: ctx.adminA.token,
      });
      assert.equal(statsRes.status, 200);
      assert.equal(statsRes.body.total, 2);
      assert.equal(statsRes.body.present, 1);
      assert.equal(statsRes.body.absent, 1);
      assert.equal(statsRes.body.percentage, 50);

      // Student 1 views attendance — should only see their own record
      const studentRes = await apiRequest('/attendance', {
        token: ctx.studentA1.token,
      });
      assert.equal(studentRes.status, 200);
      assert.equal(studentRes.body.length, 1);
      const sId = studentRes.body[0].student_id?.id || studentRes.body[0].student_id;
      assert.equal(sId, ctx.studentA1Doc._id.toString());
      assert.equal(studentRes.body[0].status, 'present');

      // Parent 1 views attendance — can view linked Student 1
      const parentRes = await apiRequest(`/attendance?student_id=${ctx.studentA1Doc._id}`, {
        token: ctx.parentA1.token,
      });
      assert.equal(parentRes.status, 200);
      assert.equal(parentRes.body.length, 1);

      // Parent 1 receives 403 when trying to access Student 2
      const parentForbidden = await apiRequest(`/attendance?student_id=${ctx.studentA2Doc._id}`, {
        token: ctx.parentA1.token,
      });
      assert.equal(parentForbidden.status, 403);
    });
  });

  describe('Fees Workflow', () => {
    it('Admin creates fee invoice and student/parent can query and pay', async () => {
      // 1. Admin creates fee for Student 1
      const createRes = await apiRequest('/fees', {
        method: 'POST',
        token: ctx.adminA.token,
        body: {
          student_id: ctx.studentA1Doc._id.toString(),
          title: 'Term 1 Tuition Fee',
          fee_type: 'Tuition',
          academic_year: '2025-2026',
          total_amount: 30000,
          due_date: '2026-10-15',
        },
      });

      assert.equal(createRes.status, 201);
      const feeId = createRes.body.id;
      assert.ok(feeId);
      assert.equal(createRes.body.status, 'Pending');

      // 2. Student queries fees
      const studentFeeRes = await apiRequest('/fees', {
        token: ctx.studentA1.token,
      });
      assert.equal(studentFeeRes.status, 200);
      assert.equal(studentFeeRes.body.length, 1);
      assert.equal(studentFeeRes.body[0].id, feeId);

      // 3. Parent pays installment of 10,000 -> Partial status
      const partialPayRes = await apiRequest(`/fees/${feeId}/pay`, {
        method: 'POST',
        token: ctx.parentA1.token,
        body: {
          amount: 10000,
          payment_method: 'UPI',
        },
      });
      assert.equal(partialPayRes.status, 200);
      assert.equal(partialPayRes.body.fee.status, 'Partial');
      assert.equal(partialPayRes.body.fee.paid_amount, 10000);

      // 4. Pay remaining 20,000 -> Paid status
      const fullPayRes = await apiRequest(`/fees/${feeId}/pay`, {
        method: 'POST',
        token: ctx.studentA1.token,
        body: {
          amount: 20000,
          payment_method: 'Card',
        },
      });
      assert.equal(fullPayRes.status, 200);
      assert.equal(fullPayRes.body.fee.status, 'Paid');
      assert.equal(fullPayRes.body.fee.paid_amount, 30000);

      // 5. Fee stats
      const statsRes = await apiRequest('/fees/stats', {
        token: ctx.adminA.token,
      });
      assert.equal(statsRes.status, 200);
      assert.equal(statsRes.body.total_fees, 30000);
      assert.equal(statsRes.body.total_paid, 30000);
      assert.equal(statsRes.body.total_pending, 0);
    });

    it('Parent cannot access or pay fees for other students', async () => {
      // Create fee for Student 2 (not linked to Parent 1)
      const createRes = await apiRequest('/fees', {
        method: 'POST',
        token: ctx.adminA.token,
        body: {
          student_id: ctx.studentA2Doc._id.toString(),
          title: 'Hostel Fee',
          total_amount: 15000,
          due_date: '2026-11-01',
        },
      });
      const feeId = createRes.body.id;

      // Parent 1 queries Student 2 fees -> 403
      const queryRes = await apiRequest(`/fees?student_id=${ctx.studentA2Doc._id}`, {
        token: ctx.parentA1.token,
      });
      assert.equal(queryRes.status, 403);

      // Parent 1 attempts to pay Student 2 fee -> 403
      const payRes = await apiRequest(`/fees/${feeId}/pay`, {
        method: 'POST',
        token: ctx.parentA1.token,
        body: { amount: 5000 },
      });
      assert.equal(payRes.status, 403);
    });
  });

  describe('Exams & Results Workflow', () => {
    it('Schedules exam, records results with computed grades, and scopes access', async () => {
      // 1. Teacher schedules exam
      const examRes = await apiRequest('/exams', {
        method: 'POST',
        token: ctx.teacherA.token,
        body: {
          title: 'Mathematics Mid-Term',
          term: 'Term 1',
          class_grade: '10',
          subject: 'Mathematics',
          date: '2026-10-25',
          total_marks: 100,
          passing_marks: 35,
        },
      });

      assert.equal(examRes.status, 201);
      const examId = examRes.body.id;
      assert.ok(examId);

      // 2. Teacher records result for Student 1 (marks: 85 -> Grade A)
      const res1 = await apiRequest('/exams/results', {
        method: 'POST',
        token: ctx.teacherA.token,
        body: {
          exam_id: examId,
          student_id: ctx.studentA1Doc._id.toString(),
          marks_obtained: 85,
        },
      });
      assert.equal(res1.status, 201);
      assert.equal(res1.body.grade, 'A');

      // 3. Teacher records result for Student 2 (marks: 92 -> Grade A+)
      const res2 = await apiRequest('/exams/results', {
        method: 'POST',
        token: ctx.teacherA.token,
        body: {
          exam_id: examId,
          student_id: ctx.studentA2Doc._id.toString(),
          marks_obtained: 92,
        },
      });
      assert.equal(res2.status, 201);
      assert.equal(res2.body.grade, 'A+');

      // 4. Student 1 queries results -> only sees their own
      const stuRes = await apiRequest('/exams/results', {
        token: ctx.studentA1.token,
      });
      assert.equal(stuRes.status, 200);
      assert.equal(stuRes.body.length, 1);
      const stuId = stuRes.body[0].student_id?.id || stuRes.body[0].student_id;
      assert.equal(stuId, ctx.studentA1Doc._id.toString());
      assert.equal(stuRes.body[0].grade, 'A');

      // 5. Parent 1 queries results -> sees linked child
      const parentRes = await apiRequest('/exams/results', {
        token: ctx.parentA1.token,
      });
      assert.equal(parentRes.status, 200);
      assert.equal(parentRes.body.length, 1);
      const parentStuId = parentRes.body[0].student_id?.id || parentRes.body[0].student_id;
      assert.equal(parentStuId, ctx.studentA1Doc._id.toString());

      // 6. Parent 1 querying Student 2 returns 403
      const parentForbidden = await apiRequest(`/exams/results?student_id=${ctx.studentA2Doc._id}`, {
        token: ctx.parentA1.token,
      });
      assert.equal(parentForbidden.status, 403);
    });
  });

  describe('Timetable Workflow', () => {
    it('Creates, retrieves, and deletes timetable with role auto-filtering', async () => {
      // 1. Teacher/Admin saves timetable for 10-A
      const schedule = [
        { time: '09:00 - 09:45', mon: 'Math', tue: 'Science', wed: 'English', thu: 'Social', fri: 'Math' },
        { time: '09:45 - 10:30', mon: 'Science', tue: 'Math', wed: 'Social', thu: 'English', fri: 'Math' },
      ];

      const saveRes = await apiRequest('/timetable', {
        method: 'POST',
        token: ctx.adminA.token,
        body: {
          class_grade: '10',
          section: 'A',
          schedule,
        },
      });

      assert.equal(saveRes.status, 200);
      const ttId = saveRes.body.id;
      assert.ok(ttId);
      assert.equal(saveRes.body.schedule.length, 2);

      // 2. Student from 10-A queries timetable without params -> automatically gets 10-A
      const stuRes = await apiRequest('/timetable', {
        token: ctx.studentA1.token,
      });
      assert.equal(stuRes.status, 200);
      assert.equal(stuRes.body.length, 1);
      assert.equal(stuRes.body[0].class_grade, '10');
      assert.equal(stuRes.body[0].section, 'A');

      // 3. Delete timetable by ID
      const delRes = await apiRequest(`/timetable/${ttId}`, {
        method: 'DELETE',
        token: ctx.adminA.token,
      });
      assert.equal(delRes.status, 200);
      assert.equal(delRes.body.success, true);
    });
  });

  describe('Dashboard Summary Stats', () => {
    it('GET /api/dashboard/stats returns metrics tailored to caller role', async () => {
      // 1. Admin dashboard
      const adminDash = await apiRequest('/dashboard/stats', {
        token: ctx.adminA.token,
      });
      assert.equal(adminDash.status, 200);
      assert.equal(adminDash.body.role, 'admin');
      assert.equal(adminDash.body.counts.students, 2);
      assert.equal(adminDash.body.counts.teachers, 1);
      assert.equal(adminDash.body.counts.parents, 1);
      assert.ok(adminDash.body.attendance);
      assert.ok(adminDash.body.fees);

      // 2. Student dashboard
      const stuDash = await apiRequest('/dashboard/stats', {
        token: ctx.studentA1.token,
      });
      assert.equal(stuDash.status, 200);
      assert.equal(stuDash.body.role, 'student');
      assert.equal(stuDash.body.role_specific.class_grade, '10');
      assert.equal(stuDash.body.role_specific.section, 'A');

      // 3. Parent dashboard
      const parentDash = await apiRequest('/dashboard/stats', {
        token: ctx.parentA1.token,
      });
      assert.equal(parentDash.status, 200);
      assert.equal(parentDash.body.role, 'parent');
      assert.equal(parentDash.body.role_specific.children_count, 1);
      assert.equal(parentDash.body.role_specific.children[0].full_name, 'Student One');
    });
  });
});
