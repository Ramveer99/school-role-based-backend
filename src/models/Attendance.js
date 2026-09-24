import mongoose from 'mongoose';
import { applyIdTransform } from './plugins.js';

const attendanceSchema = new mongoose.Schema(
  {
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    class_grade: { type: String, required: true },
    section: { type: String, required: true },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused'],
      default: 'present',
      lowercase: true,
      trim: true,
    },
    remarks: String,
    recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

attendanceSchema.index({ organization_id: 1, student_id: 1, date: 1 }, { unique: true });
attendanceSchema.index({ organization_id: 1, class_grade: 1, section: 1, date: 1 });

applyIdTransform(attendanceSchema);

export const Attendance = mongoose.model('Attendance', attendanceSchema);
