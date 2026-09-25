import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsRoot = path.resolve(__dirname, '../../uploads');
const avatarsDir = path.join(uploadsRoot, 'avatars');

if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const MAX_BYTES = 2 * 1024 * 1024;

export function saveAvatarFromBase64(imageData) {
  if (!imageData || typeof imageData !== 'string') {
    const err = new Error('No image data provided');
    err.status = 400;
    throw err;
  }

  const match = imageData.match(/^data:image\/([\w+.-]+);base64,(.+)$/);
  let ext = 'jpg';
  let base64 = imageData;

  if (match) {
    ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    base64 = match[2];
  }

  if (!ALLOWED_EXT.has(ext)) {
    const err = new Error('Only JPG, PNG, WEBP, or GIF images are allowed');
    err.status = 400;
    throw err;
  }

  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) {
    const err = new Error('Invalid image data');
    err.status = 400;
    throw err;
  }
  if (buffer.length > MAX_BYTES) {
    const err = new Error('Image must be smaller than 2MB');
    err.status = 400;
    throw err;
  }

  const filename = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(avatarsDir, filename), buffer);
  return `/uploads/avatars/${filename}`;
}

export function deleteStoredAvatar(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith('/uploads/')) return;
  const filePath = path.join(uploadsRoot, avatarUrl.replace('/uploads/', ''));
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore cleanup errors */
    }
  }
}
