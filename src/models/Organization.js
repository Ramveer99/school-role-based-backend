import mongoose from 'mongoose';
import { applyIdTransform } from './plugins.js';

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    address: String,
    phone: String,
    email: String,
    active: { type: Boolean, default: true },
    legacy_supabase_id: { type: String, unique: true, sparse: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

applyIdTransform(organizationSchema);

export const Organization = mongoose.model('Organization', organizationSchema);
