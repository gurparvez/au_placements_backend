import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import { User } from '../models/user.model';

/**
 * Bootstraps the first admin account. Since public registration is disabled,
 * run this once to create an admin who can then manage all users from the
 * admin dashboard.
 *
 *   npm run seed:admin
 *
 * Configure via env vars (with sensible defaults for local dev):
 *   ADMIN_AUID, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME,
 *   ADMIN_EMAIL, ADMIN_UNIVERSITY
 */
async function seedAdmin() {
  const auid = process.env.ADMIN_AUID || '00000';
  const password = process.env.ADMIN_PASSWORD || 'admin12345';
  const firstName = process.env.ADMIN_FIRST_NAME || 'Admin';
  const lastName = process.env.ADMIN_LAST_NAME || '';
  const email = process.env.ADMIN_EMAIL || undefined;
  const university = (process.env.ADMIN_UNIVERSITY as any) || 'Akal University';

  await connectDB();

  const existing = await User.findOne({ auid });
  if (existing) {
    if (!existing.roles.includes('admin')) {
      existing.roles = Array.from(new Set([...existing.roles, 'admin'])) as any;
      await existing.save();
      console.log(`✅ Promoted existing user (AUID ${auid}) to admin.`);
    } else {
      console.log(`ℹ️  Admin with AUID ${auid} already exists. Nothing to do.`);
    }
    await mongoose.disconnect();
    return;
  }

  await User.create({
    auid,
    password,
    firstName,
    lastName,
    email,
    university,
    roles: ['admin'],
  });

  console.log('✅ Admin user created.');
  console.log(`   AUID:     ${auid}`);
  console.log(`   Password: ${password}`);
  console.log('   ⚠️  Change this password after first login.');

  await mongoose.disconnect();
}

seedAdmin().catch((err) => {
  console.error('❌ Failed to seed admin:', err);
  process.exit(1);
});
