import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { applyIdTransform } from './plugins.js';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    legacy_supabase_id: { type: String, unique: true, sparse: true },
    password_reset_token: { type: String, select: false },
    password_reset_expires: { type: Date, select: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  if (/^\$2[aby]\$\d+\$/.test(this.password)) return next();
  this.password = await bcrypt.hash(this.password, 10);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

applyIdTransform(userSchema);

export const User = mongoose.model('User', userSchema);
