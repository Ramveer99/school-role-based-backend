/**
 * Normalize ad-hoc `users` documents (role, organizationId on user, plain passwords)
 * into User + Profile documents expected by the API.
 */
import '../src/config/env.js';
import { connectDb } from '../src/config/db.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Profile, Organization } from '../src/models/index.js';

const ROLES = new Set(['super_admin', 'admin', 'teacher', 'student', 'parent']);

async function ensureOrg(orgId) {
  if (!orgId) return null;
  const oid = new mongoose.Types.ObjectId(orgId);
  let org = await Organization.findById(oid);
  if (!org) {
    org = await Organization.create({
      _id: oid,
      name: 'Imported Organization',
      code: `ORG${oid.toString().slice(-4).toUpperCase()}`,
      active: true,
    });
    console.log('[normalize] created placeholder organization', org.code);
  }
  return org._id;
}

async function main() {
  await connectDb();
  const db = mongoose.connection.db;
  const rawUsers = await db.collection('users').find({}).toArray();

  let linked = 0;
  let createdUsers = 0;
  let failed = 0;

  for (const row of rawUsers) {
    try {
      const email = (row.email || '').toLowerCase().trim();
      if (!email) {
        failed += 1;
        continue;
      }

      let password = row.password;
      if (password && !/^\$2[aby]\$\d+\$/.test(password)) {
        password = await bcrypt.hash(password, 10);
      }

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({ email, password: row.password || 'ChangeMe123!' });
        createdUsers += 1;
      } else {
        const needsHash = row.password && !/^\$2[aby]\$\d+\$/.test(String(row.password));
        if (needsHash) {
          user.password = row.password;
          await user.save();
        }
      }

      const existingProfile = await Profile.findOne({ user_id: user._id });
      if (existingProfile) {
        linked += 1;
        continue;
      }

      const role = ROLES.has(row.role) ? row.role : 'admin';
      const orgRef = row.organization_id || row.organizationId;
      const organization_id = orgRef ? await ensureOrg(orgRef) : null;

      await Profile.create({
        user_id: user._id,
        email,
        full_name: row.full_name || row.fullName || email.split('@')[0],
        role,
        organization_id,
        phone: row.phone || null,
      });

      linked += 1;
    } catch (err) {
      failed += 1;
      console.warn('[normalize] failed', row._id, err.message);
    }
  }

  console.log('\n=== User collection normalize ===');
  console.log(`Users created/updated: ${createdUsers}`);
  console.log(`Profiles linked:         ${linked}`);
  console.log(`Failed:                  ${failed}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('[normalize] fatal', err);
  process.exit(1);
});
