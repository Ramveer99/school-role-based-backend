import mongoose from 'mongoose';
import { applyIdTransform } from './plugins.js';

const teacherSchema = new mongoose.Schema(
  {
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    profile_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    full_name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: String,
    employee_id: { type: String, required: true },
    department: String,
    subjects: String,
    classes: String,
    status: { type: String, default: 'Active' },
    joining_date: Date,
    legacy_supabase_id: { type: String, unique: true, sparse: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

teacherSchema.index({ organization_id: 1, employee_id: 1 }, { unique: true });
teacherSchema.index({ profile_id: 1 });
applyIdTransform(teacherSchema);

export const Teacher = mongoose.model('Teacher', teacherSchema);

