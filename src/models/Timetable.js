import mongoose from 'mongoose';
import { applyIdTransform } from './plugins.js';

const periodSchema = new mongoose.Schema(
  {
    time: { type: String, required: true },
    mon: { type: String, default: '' },
    tue: { type: String, default: '' },
    wed: { type: String, default: '' },
    thu: { type: String, default: '' },
    fri: { type: String, default: '' },
  },
  { _id: false }
);

const timetableSchema = new mongoose.Schema(
  {
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    class_grade: { type: String, required: true },
    section: { type: String, required: true },
    schedule: [periodSchema],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

timetableSchema.index({ organization_id: 1, class_grade: 1, section: 1 }, { unique: true });

applyIdTransform(timetableSchema);

export const Timetable = mongoose.model('Timetable', timetableSchema);
