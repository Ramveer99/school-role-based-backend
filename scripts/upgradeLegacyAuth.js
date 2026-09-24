/**
 * One-time upgrade: older MongoDB data stored password on `profiles`.
 * Creates `users` documents and links `profiles.user_id` without deleting org data.
 *
 * Safe to re-run: skips profiles that already have user_id.
 */
import '../src/config/env.js';
import { connectDb } from '../src/config/db.js';
import mongoose from 'mongoose';
import { User, Profile } from '../src/models/index.js';

async function main() {
  await connectDb();
  const db = mongoose.connection.db;
  const rawProfiles = await db.collection('profiles').find({}).toArray();

  let upgraded = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rawProfiles) {
    try {
      if (row.user_id) {
        skipped += 1;
        continue;
      }

      const email = (row.email || '').toLowerCase().trim();
      if (!email) {
        failed += 1;
        console.warn('[upgrade] profile missing email', row._id);
        continue;
      }

      let password = row.password;
      if (!password) {
        failed += 1;
        console.warn('[upgrade] profile missing password — run Supabase migration or reset password', email);
        continue;
      }

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({ email, password });
      } else if (password) {
        user.password = password;
        await user.save();
      }

      await Profile.updateOne(
        { _id: row._id },
        {
          $set: {
            user_id: user._id,
            email,
            full_name: row.full_name,
            role: row.role,
            organization_id: row.organization_id || null,
            avatar_url: row.avatar_url,
            phone: row.phone,
          },
          $unset: { password: '' },
        }
      );

      upgraded += 1;
    } catch (err) {
      failed += 1;
      console.warn('[upgrade] failed for profile', row._id, err.message);
    }
  }

  console.log('\n=== Legacy auth upgrade ===');
  console.log(`Profiles upgraded: ${upgraded}`);
  console.log(`Already linked:    ${skipped}`);
  console.log(`Failed:            ${failed}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('[upgrade] fatal', err);
  process.exit(1);
});
