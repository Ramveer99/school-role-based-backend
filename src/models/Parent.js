import mongoose from 'mongoose';
import { applyIdTransform } from './plugins.js';

const parentSchema = new mongoose.Schema(
  {
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    profile_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    full_name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: String,
    occupation: String,
    address: String,
    legacy_supabase_id: { type: String, unique: true, sparse: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

parentSchema.index({ organization_id: 1, email: 1 });
parentSchema.index({ profile_id: 1 });
applyIdTransform(parentSchema);

export const Parent = mongoose.model('Parent', parentSchema);

