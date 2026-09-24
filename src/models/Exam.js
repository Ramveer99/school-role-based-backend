import mongoose from 'mongoose';
import { applyIdTransform } from './plugins.js';

const examSchema = new mongoose.Schema(
  {
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String, required: true },
    term: { type: String, default: 'Term 1' },
    class_grade: { type: String, required: true },
    subject: { type: String, required: true },
    date: { type: Date, required: true },
    start_time: String,
    duration: String,
    total_marks: { type: Number, default: 100 },
    passing_marks: { type: Number, default: 35 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

examSchema.index({ organization_id: 1, class_grade: 1 });

applyIdTransform(examSchema);

export const Exam = mongoose.model('Exam', examSchema);
