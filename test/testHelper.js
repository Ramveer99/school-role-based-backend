import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import {
  Organization,
  User,
  Profile,
  Teacher,
  Parent,
  Student,
  ClassModel,
  StudentParent,
  Notice,
} from '../src/models/index.js';
import { signToken } from '../src/middleware/auth.js';
import { clearSentEmails } from '../src/services/emailService.js';

let mongod = null;
let server = null;
let baseUrl = '';

export async function setupTestEnvironment() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-12345';
  process.env.JWT_EXPIRES_IN = '1d';

  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  const app = createApp();
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });

  return { baseUrl };
}

export async function teardownTestEnvironment() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
}

export async function clearDatabase() {
  clearSentEmails();
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export async function seedTestSchoolData() {
  await clearDatabase();

  // Create two distinct organizations for isolation testing
  const [schoolA, schoolB] = await Organization.insertMany([
    {
      name: 'School Alpha',
      code: 'ALPHA',
      address: '10 Alpha Way',
      email: 'info@schoolalpha.edu',
      active: true,
    },
    {
      name: 'School Beta',
      code: 'BETA',
      address: '20 Beta Road',
      email: 'info@schoolbeta.edu',
      active: true,
    },
  ]);

  const password = 'Password123!';

  async function createTestAccount({ email, full_name, role, organization_id, phone }) {
    const user = await User.create({ email: email.toLowerCase().trim(), password });
    const profile = await Profile.create({
      user_id: user._id,
      email: email.toLowerCase().trim(),
      full_name,
      role,
      organization_id: organization_id || null,
      phone: phone || null,
    });
    const token = signToken(profile);
    return { user, profile, token };
  }

  const superAdmin = await createTestAccount({
    email: 'superadmin@test.edu',
    full_name: 'Platform Super Admin',
    role: 'super_admin',
  });

  const adminA = await createTestAccount({
    email: 'admin.a@schoolalpha.edu',
    full_name: 'Admin Alpha',
    role: 'admin',
    organization_id: schoolA._id,
  });

  const adminB = await createTestAccount({
    email: 'admin.b@schoolbeta.edu',
    full_name: 'Admin Beta',
    role: 'admin',
    organization_id: schoolB._id,
  });

  const teacherA = await createTestAccount({
    email: 'teacher.a@schoolalpha.edu',
    full_name: 'Teacher Alice',
    role: 'teacher',
    organization_id: schoolA._id,
  });

  const teacherADoc = await Teacher.create({
    organization_id: schoolA._id,
    profile_id: teacherA.profile._id,
    full_name: 'Teacher Alice',
    email: 'teacher.a@schoolalpha.edu',
    employee_id: 'EMP-A-001',
    classes: '10-A',
  });

  const classA = await ClassModel.create({
    organization_id: schoolA._id,
    grade: '10',
    section: 'A',
    teacher_id: teacherADoc._id,
  });

  const classB = await ClassModel.create({
    organization_id: schoolB._id,
    grade: '10',
    section: 'A',
  });

  const studentA1 = await createTestAccount({
    email: 'student.a1@schoolalpha.edu',
    full_name: 'Student One',
    role: 'student',
    organization_id: schoolA._id,
  });

  const studentA1Doc = await Student.create({
    organization_id: schoolA._id,
    profile_id: studentA1.profile._id,
    admission_no: 'STU-A-001',
    full_name: 'Student One',
    class_grade: '10',
    section: 'A',
    teacher_id: teacherADoc._id,
    status: 'Active',
  });

  const studentA2 = await createTestAccount({
    email: 'student.a2@schoolalpha.edu',
    full_name: 'Student Two',
    role: 'student',
    organization_id: schoolA._id,
  });

  const studentA2Doc = await Student.create({
    organization_id: schoolA._id,
    profile_id: studentA2.profile._id,
    admission_no: 'STU-A-002',
    full_name: 'Student Two',
    class_grade: '10',
    section: 'A',
    status: 'Active',
  });

  const parentA1 = await createTestAccount({
    email: 'parent.a1@example.com',
    full_name: 'Parent One',
    role: 'parent',
    organization_id: schoolA._id,
  });

  const parentA1Doc = await Parent.create({
    organization_id: schoolA._id,
    profile_id: parentA1.profile._id,
    full_name: 'Parent One',
    email: 'parent.a1@example.com',
  });

  // Link Parent 1 to Student 1 only
  await StudentParent.create({
    student_id: studentA1Doc._id,
    parent_id: parentA1Doc._id,
  });

  return {
    schoolA,
    schoolB,
    classA,
    classB,
    superAdmin,
    adminA,
    adminB,
    teacherA,
    teacherADoc,
    studentA1,
    studentA1Doc,
    studentA2,
    studentA2Doc,
    parentA1,
    parentA1Doc,
    defaultPassword: password,
  };
}

export async function apiRequest(path, options = {}) {
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  const text = await response.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    status: response.status,
    ok: response.ok,
    body: data,
    headers: response.headers,
  };
}
