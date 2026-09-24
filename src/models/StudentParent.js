import mongoose from 'mongoose';
import { applyIdTransform } from './plugins.js';

const studentParentSchema = new mongoose.Schema(
  {
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    parent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent', required: true },
    legacy_supabase_id: { type: String, unique: true, sparse: true },
  },
  { timestamps: false }
);

studentParentSchema.index({ student_id: 1, parent_id: 1 }, { unique: true });
applyIdTransform(studentParentSchema);

export const StudentParent = mongoose.model('StudentParent', studentParentSchema);
