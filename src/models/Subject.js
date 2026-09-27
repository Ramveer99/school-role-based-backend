import mongoose from 'mongoose';
import { applyIdTransform } from './plugins.js';

const subjectSchema = new mongoose.Schema(
  {
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: '' },
    class_grade: { type: String, required: true, trim: true },
    section: { type: String, trim: true, default: '' },
    class_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
    teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
    description: { type: String, default: '' },
    status: { type: String, default: 'Active' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

subjectSchema.index({ organization_id: 1, class_grade: 1, section: 1, name: 1 }, { unique: true });
subjectSchema.index({ organization_id: 1, teacher_id: 1 });
applyIdTransform(subjectSchema);

export const Subject = mongoose.model('Subject', subjectSchema);
