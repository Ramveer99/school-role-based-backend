import mongoose from 'mongoose';
import { applyIdTransform } from './plugins.js';

const feePaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    payment_method: { type: String, default: 'Online' },
    transaction_id: String,
    receipt_no: String,
  },
  { _id: true }
);

const feeSchema = new mongoose.Schema(
  {
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    title: { type: String, required: true },
    fee_type: { type: String, default: 'Tuition' },
    academic_year: { type: String, default: '2025-2026' },
    total_amount: { type: Number, required: true },
    paid_amount: { type: Number, default: 0 },
    due_date: { type: Date, required: true },
    status: {
      type: String,
      enum: ['Paid', 'Pending', 'Overdue', 'Partial'],
      default: 'Pending',
    },
    payments: [feePaymentSchema],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

feeSchema.index({ organization_id: 1, student_id: 1 });
feeSchema.index({ organization_id: 1, status: 1 });

applyIdTransform(feeSchema);

export const Fee = mongoose.model('Fee', feeSchema);
