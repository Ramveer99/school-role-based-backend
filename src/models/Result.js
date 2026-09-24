import mongoose from 'mongoose';
import { applyIdTransform } from './plugins.js';

const resultSchema = new mongoose.Schema(
  {
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    exam_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    marks_obtained: { type: Number, required: true },
    grade: String,
    remarks: String,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

resultSchema.index({ organization_id: 1, exam_id: 1, student_id: 1 }, { unique: true });

applyIdTransform(resultSchema);

export const Result = mongoose.model('Result', resultSchema);
