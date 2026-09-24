import mongoose from 'mongoose';
import { applyIdTransform } from './plugins.js';

const ROLES = ['super_admin', 'admin', 'teacher', 'student', 'parent'];

const profileSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    full_name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: ROLES },
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    avatar_url: String,
    phone: String,
    legacy_supabase_id: { type: String, unique: true, sparse: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

profileSchema.index({ email: 1 });
profileSchema.index({ organization_id: 1, role: 1 });

applyIdTransform(profileSchema);

export const Profile = mongoose.model('Profile', profileSchema);
export { ROLES };
