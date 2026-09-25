import { User, Profile } from '../models/index.js';
import { saveAvatarFromBase64 } from './avatarStorage.js';

export async function createAuthUser({
  email,
  password = 'password123',
  full_name,
  role,
  organization_id,
  phone,
  avatar_image,
}) {
  let avatar_url = null;
  if (avatar_image) {
    avatar_url = saveAvatarFromBase64(avatar_image);
  }
  const normalizedEmail = email.toLowerCase().trim();

  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    user = await User.create({ email: normalizedEmail, password });
  } else if (password) {
    user.password = password;
    await user.save();
  }

  let profile = await Profile.findOne({ user_id: user._id });
  if (profile) {
    profile.full_name = full_name;
    profile.role = role;
    profile.email = normalizedEmail;
    profile.organization_id = organization_id || null;
    if (phone !== undefined) profile.phone = phone || null;
    if (avatar_url) profile.avatar_url = avatar_url;
    await profile.save();
    return profile._id;
  }

  profile = await Profile.create({
    user_id: user._id,
    email: normalizedEmail,
    full_name,
    role,
    organization_id: organization_id || null,
    phone: phone || null,
    avatar_url,
  });
  return profile._id;
}

export function resolveOrgId(profile, bodyOrgId) {
  if (profile.role === 'super_admin') {
    return bodyOrgId || profile.organization_id;
  }
  return profile.organization_id;
}
