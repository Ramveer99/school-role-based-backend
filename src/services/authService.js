import crypto from 'node:crypto';
import { User, Profile } from '../models/index.js';
import { signToken } from '../middleware/auth.js';
import { sendPasswordResetEmail } from './emailService.js';

export function publicUserPayload(profile) {
  return {
    id: profile.id || profile._id?.toString?.(),
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
    organization_id: profile.organization_id,
  };
}

export async function loginWithEmailPassword(email, password) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return { error: 'Invalid email or password', status: 401 };
  }

  const profile = await Profile.findOne({ user_id: user._id }).populate(
    'organization_id',
    'name code active'
  );
  if (!profile) {
    return { error: 'Account profile not found', status: 401 };
  }

  const token = signToken(profile);
  const json = profile.toJSON();
  const org = profile.organization_id;
  const enriched = {
    ...json,
    organization_id: org?._id?.toString?.() || json.organization_id,
    organization: org?.name
      ? { id: org._id.toString(), name: org.name, code: org.code, active: org.active }
      : null,
  };

  return { token, user: publicUserPayload(enriched), profile: enriched };
}

export async function registerUser({
  email,
  password,
  full_name,
  role,
  organization_id,
  phone,
}) {
  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return { error: 'Email already registered', status: 409, duplicate: true };
  }

  const user = await User.create({ email: normalizedEmail, password });
  const profile = await Profile.create({
    user_id: user._id,
    email: normalizedEmail,
    full_name,
    role,
    organization_id: organization_id || null,
    phone: phone || null,
  });

  const token = signToken(profile);
  return { token, user: publicUserPayload(profile.toJSON()), profile: profile.toJSON() };
}

export async function getMeFromProfileId(profileId) {
  const profile = await Profile.findById(profileId).populate('organization_id', 'name code active');
  if (!profile) return null;

  const json = profile.toJSON();
  const org = profile.organization_id;
  return {
    id: json.id,
    email: json.email,
    full_name: json.full_name,
    role: json.role,
    organization_id: org?._id?.toString?.() || json.organization_id,
    organization_name: org?.name || null,
    avatar_url: json.avatar_url,
    phone: json.phone,
  };
}

export async function requestPasswordReset(email) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return { ok: true, message: 'If that email exists, a reset link was sent.' };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.password_reset_token = hashed;
  user.password_reset_expires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  // Send email asynchronously
  await sendPasswordResetEmail({ email: user.email, resetToken: rawToken });

  return {
    ok: true,
    message: 'If that email exists, a reset link was sent.',
    resetToken: rawToken,
  };
}

export async function resetPasswordWithToken(token, newPassword) {
  if (!token || !newPassword || newPassword.length < 8) {
    return { error: 'Valid token and password (min 8 chars) required', status: 400 };
  }

  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    password_reset_token: hashed,
    password_reset_expires: { $gt: new Date() },
  }).select('+password_reset_token +password_reset_expires +password');

  if (!user) {
    return { error: 'Invalid or expired reset token', status: 400 };
  }

  user.password = newPassword;
  user.password_reset_token = undefined;
  user.password_reset_expires = undefined;
  await user.save();

  return { ok: true, success: true, message: 'Password has been reset successfully' };
}

export async function changePassword({ userId, currentPassword, newPassword }) {
  if (!userId) {
    return { error: 'Unauthorized', status: 401 };
  }
  if (!currentPassword || !newPassword) {
    return { error: 'Both current password and new password are required', status: 400 };
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return { error: 'New password must be at least 6 characters long', status: 400 };
  }
  if (currentPassword === newPassword) {
    return { error: 'New password must be different from the current password', status: 400 };
  }

  const user = await User.findById(userId).select('+password');
  if (!user) {
    return { error: 'User account not found', status: 404 };
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return { error: 'Current password is incorrect', status: 400 };
  }

  user.password = newPassword;
  await user.save();

  return { ok: true, success: true, message: 'Password updated successfully' };
}

