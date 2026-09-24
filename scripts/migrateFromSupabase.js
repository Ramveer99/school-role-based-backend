/**
 * Import Supabase Postgres / REST data into MongoDB.
 *
 * Required: MONGODB_URI
 * Public tables: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY with RLS disabled)
 * Auth passwords: SUPABASE_DATABASE_URL (postgres) to read auth.users.encrypted_password
 *
 * Safe to re-run: skips rows already present via legacy_supabase_id / email.
 */
import '../src/config/env.js';
import { connectDb } from '../src/config/db.js';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import {
  User,
  Profile,
  Organization,
  Teacher,
  Parent,
  Student,
  ClassModel,
  StudentParent,
  Notice,
} from '../src/models/index.js';
import { env } from '../src/config/env.js';

const report = {
  users: 0,
  organizations: 0,
  profiles: 0,
  classes: 0,
  notices: 0,
  parents: 0,
  students: 0,
  teachers: 0,
  student_parents: 0,
  failed: [],
  duplicates: [],
};

const idMap = {
  users: new Map(),
  profiles: new Map(),
  organizations: new Map(),
  teachers: new Map(),
  parents: new Map(),
  students: new Map(),
  classes: new Map(),
};

function recordDuplicate(entity, legacyId, reason) {
  report.duplicates.push({ entity, legacyId, reason });
}

function recordFailure(entity, legacyId, error) {
  report.failed.push({ entity, legacyId, error: error?.message || String(error) });
}

function supabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are required');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchAll(supabase, table, select = '*') {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function loadAuthUsersFromPostgres() {
  const conn = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  if (!conn) return [];

  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    const { rows } = await client.query(
      'select id, email, encrypted_password from auth.users order by created_at asc'
    );
    return rows;
  } finally {
    await client.end();
  }
}

async function migrateOrganizations(supabase) {
  const rows = await fetchAll(supabase, 'organizations');
  for (const row of rows) {
    try {
      const legacyId = String(row.id);
      const existing = await Organization.findOne({ legacy_supabase_id: legacyId });
      if (existing) {
        idMap.organizations.set(legacyId, existing._id);
        recordDuplicate('organizations', legacyId, 'already migrated');
        continue;
      }

      const doc = await Organization.create({
        name: row.name,
        code: row.code,
        address: row.address,
        phone: row.phone,
        email: row.email,
        active: row.active ?? true,
        legacy_supabase_id: legacyId,
        created_at: row.created_at ? new Date(row.created_at) : undefined,
      });
      idMap.organizations.set(legacyId, doc._id);
      report.organizations += 1;
    } catch (err) {
      recordFailure('organizations', row.id, err);
    }
  }
}

async function migrateAuthUsers(authRows) {
  for (const row of authRows) {
    try {
      const legacyId = String(row.id);
      const email = (row.email || '').toLowerCase().trim();
      if (!email) {
        recordFailure('users', legacyId, new Error('missing email'));
        continue;
      }

      let user = await User.findOne({ $or: [{ legacy_supabase_id: legacyId }, { email }] });
      if (user) {
        idMap.users.set(legacyId, user._id);
        recordDuplicate('users', legacyId, 'already migrated');
        continue;
      }

      const password = row.encrypted_password;
      if (!password) {
        recordFailure('users', legacyId, new Error('missing encrypted_password; set SUPABASE_DATABASE_URL'));
        continue;
      }

      user = await User.create({
        email,
        password,
        legacy_supabase_id: legacyId,
      });
      idMap.users.set(legacyId, user._id);
      report.users += 1;
    } catch (err) {
      recordFailure('users', row.id, err);
    }
  }
}

async function migrateProfiles(supabase) {
  const rows = await fetchAll(supabase, 'profiles');
  for (const row of rows) {
    try {
      const legacyId = String(row.id);
      const existing = await Profile.findOne({ legacy_supabase_id: legacyId });
      if (existing) {
        idMap.profiles.set(legacyId, existing._id);
        recordDuplicate('profiles', legacyId, 'already migrated');
        continue;
      }

      const userId = idMap.users.get(legacyId);
      if (!userId) {
        recordFailure('profiles', legacyId, new Error('no matching auth user'));
        continue;
      }

      const orgId = row.organization_id ? idMap.organizations.get(String(row.organization_id)) : null;

      const doc = await Profile.create({
        user_id: userId,
        email: (row.email || '').toLowerCase(),
        full_name: row.full_name,
        role: row.role,
        organization_id: orgId || null,
        avatar_url: row.avatar_url,
        phone: row.phone,
        legacy_supabase_id: legacyId,
        created_at: row.created_at ? new Date(row.created_at) : undefined,
      });
      idMap.profiles.set(legacyId, doc._id);
      report.profiles += 1;
    } catch (err) {
      recordFailure('profiles', row.id, err);
    }
  }
}

async function migrateTeachers(supabase) {
  const rows = await fetchAll(supabase, 'teachers');
  for (const row of rows) {
    try {
      const legacyId = String(row.id);
      const existing = await Teacher.findOne({ legacy_supabase_id: legacyId });
      if (existing) {
        idMap.teachers.set(legacyId, existing._id);
        recordDuplicate('teachers', legacyId, 'already migrated');
        continue;
      }

      const orgId = idMap.organizations.get(String(row.organization_id));
      if (!orgId) {
        recordFailure('teachers', legacyId, new Error('organization not mapped'));
        continue;
      }

      const profileId = row.profile_id ? idMap.profiles.get(String(row.profile_id)) : null;

      const doc = await Teacher.create({
        organization_id: orgId,
        profile_id: profileId,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        employee_id: row.employee_id,
        department: row.department,
        subjects: row.subjects,
        classes: row.classes,
        status: row.status || 'Active',
        joining_date: row.joining_date ? new Date(row.joining_date) : null,
        legacy_supabase_id: legacyId,
        created_at: row.created_at ? new Date(row.created_at) : undefined,
      });
      idMap.teachers.set(legacyId, doc._id);
      report.teachers += 1;
    } catch (err) {
      recordFailure('teachers', row.id, err);
    }
  }
}

async function migrateParents(supabase) {
  const rows = await fetchAll(supabase, 'parents');
  for (const row of rows) {
    try {
      const legacyId = String(row.id);
      const existing = await Parent.findOne({ legacy_supabase_id: legacyId });
      if (existing) {
        idMap.parents.set(legacyId, existing._id);
        recordDuplicate('parents', legacyId, 'already migrated');
        continue;
      }

      const orgId = idMap.organizations.get(String(row.organization_id));
      if (!orgId) {
        recordFailure('parents', legacyId, new Error('organization not mapped'));
        continue;
      }

      const profileId = row.profile_id ? idMap.profiles.get(String(row.profile_id)) : null;

      const doc = await Parent.create({
        organization_id: orgId,
        profile_id: profileId,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        occupation: row.occupation,
        address: row.address,
        legacy_supabase_id: legacyId,
        created_at: row.created_at ? new Date(row.created_at) : undefined,
      });
      idMap.parents.set(legacyId, doc._id);
      report.parents += 1;
    } catch (err) {
      recordFailure('parents', row.id, err);
    }
  }
}

async function migrateStudents(supabase) {
  const rows = await fetchAll(supabase, 'students');
  for (const row of rows) {
    try {
      const legacyId = String(row.id);
      const existing = await Student.findOne({ legacy_supabase_id: legacyId });
      if (existing) {
        idMap.students.set(legacyId, existing._id);
        recordDuplicate('students', legacyId, 'already migrated');
        continue;
      }

      const orgId = idMap.organizations.get(String(row.organization_id));
      if (!orgId) {
        recordFailure('students', legacyId, new Error('organization not mapped'));
        continue;
      }

      const profileId = row.profile_id ? idMap.profiles.get(String(row.profile_id)) : null;
      const teacherId = row.teacher_id ? idMap.teachers.get(String(row.teacher_id)) : null;

      const doc = await Student.create({
        organization_id: orgId,
        profile_id: profileId,
        admission_no: row.admission_no,
        full_name: row.full_name,
        roll_no: row.roll_no,
        class_grade: row.class_grade || '',
        section: row.section,
        gender: row.gender,
        dob: row.dob ? new Date(row.dob) : null,
        phone: row.phone,
        address: row.address,
        teacher_id: teacherId,
        status: row.status || 'Active',
        legacy_supabase_id: legacyId,
        created_at: row.created_at ? new Date(row.created_at) : undefined,
      });
      idMap.students.set(legacyId, doc._id);
      report.students += 1;
    } catch (err) {
      recordFailure('students', row.id, err);
    }
  }
}

async function migrateClasses(supabase) {
  const rows = await fetchAll(supabase, 'classes');
  for (const row of rows) {
    try {
      const legacyId = String(row.id);
      const existing = await ClassModel.findOne({ legacy_supabase_id: legacyId });
      if (existing) {
        idMap.classes.set(legacyId, existing._id);
        recordDuplicate('classes', legacyId, 'already migrated');
        continue;
      }

      const orgId = idMap.organizations.get(String(row.organization_id));
      if (!orgId) {
        recordFailure('classes', legacyId, new Error('organization not mapped'));
        continue;
      }

      const teacherId = row.teacher_id ? idMap.teachers.get(String(row.teacher_id)) : null;

      const doc = await ClassModel.create({
        organization_id: orgId,
        grade: row.grade,
        section: row.section,
        teacher_id: teacherId,
        legacy_supabase_id: legacyId,
        created_at: row.created_at ? new Date(row.created_at) : undefined,
      });
      idMap.classes.set(legacyId, doc._id);
      report.classes += 1;
    } catch (err) {
      recordFailure('classes', row.id, err);
    }
  }
}

async function migrateStudentParents(supabase) {
  const rows = await fetchAll(supabase, 'student_parents');
  for (const row of rows) {
    try {
      const legacyId = String(row.id);
      const existing = await StudentParent.findOne({ legacy_supabase_id: legacyId });
      if (existing) {
        recordDuplicate('student_parents', legacyId, 'already migrated');
        continue;
      }

      const studentId = idMap.students.get(String(row.student_id));
      const parentId = idMap.parents.get(String(row.parent_id));
      if (!studentId || !parentId) {
        recordFailure('student_parents', legacyId, new Error('student or parent not mapped'));
        continue;
      }

      await StudentParent.create({
        student_id: studentId,
        parent_id: parentId,
        legacy_supabase_id: legacyId,
      });
      report.student_parents += 1;
    } catch (err) {
      if (err?.code === 11000) {
        recordDuplicate('student_parents', row.id, 'unique link exists');
      } else {
        recordFailure('student_parents', row.id, err);
      }
    }
  }
}

async function migrateNotices(supabase) {
  const rows = await fetchAll(supabase, 'notices');
  for (const row of rows) {
    try {
      const legacyId = String(row.id);
      const existing = await Notice.findOne({ legacy_supabase_id: legacyId });
      if (existing) {
        recordDuplicate('notices', legacyId, 'already migrated');
        continue;
      }

      const orgId = idMap.organizations.get(String(row.organization_id));
      if (!orgId) {
        recordFailure('notices', legacyId, new Error('organization not mapped'));
        continue;
      }

      const createdBy = row.created_by ? idMap.profiles.get(String(row.created_by)) : null;

      await Notice.create({
        organization_id: orgId,
        title: row.title,
        description: row.description,
        audience: row.audience || 'Everyone',
        color: row.color || 'blue',
        created_by: createdBy,
        legacy_supabase_id: legacyId,
        created_at: row.created_at ? new Date(row.created_at) : undefined,
      });
      report.notices += 1;
    } catch (err) {
      recordFailure('notices', row.id, err);
    }
  }
}

function printReport() {
  console.log('\n=== Supabase → MongoDB migration report ===');
  console.log(`Users migrated:              ${report.users}`);
  console.log(`Organizations migrated:      ${report.organizations}`);
  console.log(`Profiles migrated:           ${report.profiles}`);
  console.log(`Classes migrated:            ${report.classes}`);
  console.log(`Notices migrated:            ${report.notices}`);
  console.log(`Parents migrated:            ${report.parents}`);
  console.log(`Students migrated:           ${report.students}`);
  console.log(`Teachers migrated:           ${report.teachers}`);
  console.log(`Student-parent links:        ${report.student_parents}`);
  console.log(`Duplicate/skipped records:   ${report.duplicates.length}`);
  console.log(`Failed records:              ${report.failed.length}`);

  if (report.duplicates.length) {
    console.log('\nDuplicates (first 20):');
    report.duplicates.slice(0, 20).forEach((d) => console.log(`  [${d.entity}] ${d.legacyId}: ${d.reason}`));
  }
  if (report.failed.length) {
    console.log('\nFailures (first 20):');
    report.failed.slice(0, 20).forEach((f) => console.log(`  [${f.entity}] ${f.legacyId}: ${f.error}`));
  }
  console.log('\nSupabase source data was not modified.');
}

async function main() {
  console.log('[migrate] Connecting to MongoDB…');
  await connectDb();
  console.log(`[migrate] Target: ${env.mongodbUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')}`);

  const supabase = supabaseClient();
  const authRows = await loadAuthUsersFromPostgres();
  if (!authRows.length) {
    console.warn(
      '[migrate] No auth.users rows from Postgres. Set SUPABASE_DATABASE_URL to migrate passwords.'
    );
  } else {
    console.log(`[migrate] Loaded ${authRows.length} auth.users from Postgres`);
  }

  await migrateOrganizations(supabase);
  await migrateAuthUsers(authRows);
  await migrateProfiles(supabase);
  await migrateTeachers(supabase);
  await migrateParents(supabase);
  await migrateStudents(supabase);
  await migrateClasses(supabase);
  await migrateStudentParents(supabase);
  await migrateNotices(supabase);

  printReport();
  process.exit(report.failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('[migrate] Fatal error', err);
  process.exit(1);
});
