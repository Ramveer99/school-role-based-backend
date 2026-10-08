import crypto from 'node:crypto';
import { env } from '../config/env.js';

function encryptionKey() {
  return crypto.createHash('sha256')
    .update(`school-default-password:v1:${env.defaultPasswordEncryptionKey || env.jwtSecret}`)
    .digest();
}

export function encryptDefaultPassword(password) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString('base64')).join('.');
}

export function decryptDefaultPassword(value) {
  const [iv, tag, encrypted] = value.split('.').map(part => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
