import mongoose from 'mongoose';

// Keep retrievable credentials out of organization/profile responses and updates.
const schema = new mongoose.Schema({
  organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
  encrypted_password: { type: String, required: true, select: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const OrganizationPasswordSetting = mongoose.model('OrganizationPasswordSetting', schema);
