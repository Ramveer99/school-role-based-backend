import mongoose from 'mongoose';
import { applyIdTransform } from './plugins.js';

const studentSchema = new mongoose.Schema(
  {
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    profile_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    admission_no: { type: String, required: true },
    full_name: { type: String, required: true },
    roll_no: String,
    class_grade: { type: String, default: '' },
    section: String,
    gender: String,
    dob: Date,
    email: { type: String, lowercase: true, trim: true, default: null },
    phone: String,
    address: String,
    teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    status: { type: String, default: 'Active' },
    legacy_supabase_id: { type: String, unique: true, sparse: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

studentSchema.index({ organization_id: 1, admission_no: 1 }, { unique: true });
studentSchema.index({ organization_id: 1, email: 1 });
applyIdTransform(studentSchema);

export const Student = mongoose.model('Student', studentSchema);
