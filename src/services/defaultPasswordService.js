import crypto from 'node:crypto';
import { Organization } from '../models/index.js';
import { OrganizationPasswordSetting } from '../models/OrganizationPasswordSetting.js';
import { encryptDefaultPassword, decryptDefaultPassword } from '../utils/passwordEncryption.js';

export function validateDefaultPassword(password) {
  return typeof password === 'string' && password.length >= 8
    && Buffer.byteLength(password, 'utf8') <= 72 && password.trim().length > 0
    // User.save treats this prefix as an already-hashed password.
    && !/^\$2[aby]\$\d+\$/.test(password);
}

export async function getDefaultPassword(organizationId) {
  if (!organizationId || !await Organization.exists({ _id: organizationId })) {
    const error = new Error('Organization not found');
    error.status = 404;
    throw error;
  }
  let setting = await OrganizationPasswordSetting.findOne({ organization_id: organizationId }).select('+encrypted_password');
  if (!setting) {
    const encrypted_password = encryptDefaultPassword(`Edu@${crypto.randomBytes(12).toString('hex')}!`);
    try {
      setting = await OrganizationPasswordSetting.findOneAndUpdate(
        { organization_id: organizationId },
        { $setOnInsert: { encrypted_password } },
        { upsert: true, new: true, runValidators: true }
      ).select('+encrypted_password');
    } catch (error) {
      if (error.code !== 11000) throw error;
      setting = await OrganizationPasswordSetting.findOne({ organization_id: organizationId }).select('+encrypted_password');
    }
  }
  return decryptDefaultPassword(setting.encrypted_password);
}

export async function setDefaultPassword(organizationId, password) {
  await OrganizationPasswordSetting.findOneAndUpdate(
    { organization_id: organizationId },
    { $set: { encrypted_password: encryptDefaultPassword(password) } },
    { upsert: true, runValidators: true }
  );
}
