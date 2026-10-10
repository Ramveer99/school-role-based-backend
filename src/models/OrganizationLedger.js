import mongoose from 'mongoose';

const entrySchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['charge', 'payment', 'allocation', 'reversal'] },
  amount_paise: Number,
  date: { type: String, required: true },
  description: String,
  service_from: String,
  service_to: String,
  due_date: String,
  payment_method: String,
  reference: String,
  charge_id: mongoose.Schema.Types.ObjectId,
  payment_id: mongoose.Schema.Types.ObjectId,
  reverses_id: mongoose.Schema.Types.ObjectId,
  reason: String,
  request_key: String,
  request_hash: String,
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  created_at: { type: Date, default: Date.now },
});

// One document per school makes balance checks and event appends atomic even on
// standalone MongoDB. Optimistic concurrency rejects stale concurrent writes.
const schema = new mongoose.Schema({
  organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
  currency: { type: String, enum: ['INR'], default: 'INR' },
  entries: { type: [entrySchema], default: [] },
}, { optimisticConcurrency: true });

export const OrganizationLedger = mongoose.model('OrganizationLedger', schema);
