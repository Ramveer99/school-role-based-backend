import mongoose from 'mongoose';
import { applyIdTransform } from './plugins.js';

const noticeSchema = new mongoose.Schema(
  {
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String, required: true },
    description: String,
    audience: { type: String, default: 'Everyone' },
    color: { type: String, default: 'blue' },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    legacy_supabase_id: { type: String, unique: true, sparse: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

applyIdTransform(noticeSchema);

export const Notice = mongoose.model('Notice', noticeSchema);
