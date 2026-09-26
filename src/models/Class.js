import mongoose from 'mongoose';
import { applyIdTransform } from './plugins.js';

const classSchema = new mongoose.Schema(
  {
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    grade: { type: String, required: true },
    section: { type: String, required: true },
    teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null }, // Single Class Teacher
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }], // Multiple Teachers
    legacy_supabase_id: { type: String, unique: true, sparse: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

classSchema.index({ organization_id: 1, grade: 1, section: 1 }, { unique: true });
applyIdTransform(classSchema);

export const ClassModel = mongoose.model('Class', classSchema);
