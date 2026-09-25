import mongoose from 'mongoose';
import { Profile } from '../models/index.js';

export async function attachAvatarUrls(items) {
  if (!items?.length) return items;

  const profileIds = [
    ...new Set(
      items
        .map((item) => item.profile_id)
        .filter(Boolean)
        .map((id) => id.toString())
    ),
  ];

  if (!profileIds.length) {
    return items.map((item) => ({ ...item, avatar_url: item.avatar_url || null }));
  }

  const profiles = await Profile.find({
    _id: { $in: profileIds.map((id) => new mongoose.Types.ObjectId(id)) },
  }).select('avatar_url');

  const avatarByProfileId = {};
  profiles.forEach((profile) => {
    avatarByProfileId[profile._id.toString()] = profile.avatar_url || null;
  });

  return items.map((item) => {
    const profileId = item.profile_id?.toString?.() || item.profile_id || null;
    return {
      ...item,
      avatar_url: profileId ? avatarByProfileId[profileId] || null : item.avatar_url || null,
    };
  });
}
