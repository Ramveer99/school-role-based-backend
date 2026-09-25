import { Profile } from '../models/index.js';
import { profileHasRole } from '../middleware/auth.js';
import { deleteStoredAvatar, saveAvatarFromBase64 } from '../utils/avatarStorage.js';

async function updateProfileAvatar(profile, imageData) {
  const avatar_url = saveAvatarFromBase64(imageData);
  deleteStoredAvatar(profile.avatar_url);
  profile.avatar_url = avatar_url;
  await profile.save();
  return avatar_url;
}

export async function uploadMyAvatar(req, res, next) {
  try {
    const profile = await Profile.findById(req.profile.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const avatar_url = await updateProfileAvatar(profile, req.body?.image);
    return res.json({ avatar_url });
  } catch (err) {
    return next(err);
  }
}

export async function uploadProfileAvatar(req, res, next) {
  try {
    const { id } = req.params;
    const target = await Profile.findById(id);
    if (!target) return res.status(404).json({ error: 'Profile not found' });

    const isSelf = req.profile.id === id;
    const isAdmin = profileHasRole(req.profile, ['admin', 'super_admin']);
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const avatar_url = await updateProfileAvatar(target, req.body?.image);
    return res.json({ avatar_url });
  } catch (err) {
    return next(err);
  }
}
