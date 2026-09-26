import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
const projectRoot = path.resolve(backendRoot, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  dotenv.config({ path: filePath, override: false });
}

loadEnvFile(path.join(backendRoot, '.env'));
loadEnvFile(path.join(projectRoot, '.env.local'));
loadEnvFile(path.join(projectRoot, '.env'));

function resolveStaticDir() {
  if (process.env.STATIC_DIR) return path.resolve(process.env.STATIC_DIR);
  const bundledDist = path.join(backendRoot, 'dist');
  const siblingDist = path.join(projectRoot, 'dist');
  if (fs.existsSync(path.join(bundledDist, 'index.html'))) return bundledDist;
  return siblingDist;
}

const staticDir = resolveStaticDir();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || process.env.API_PORT || 8787),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school_dashboard',
  jwtSecret: process.env.JWT_SECRET || 'educore-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || true,
  frontendUrl: process.env.FRONTEND_URL || 'https://educore-school-erp-1ha7.arcada.app',
  staticDir,
  serveStatic:
    process.env.SERVE_STATIC === 'true' ||
    (process.env.SERVE_STATIC !== 'false' && fs.existsSync(path.join(staticDir, 'index.html'))),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'EduCore School ERP <no-reply@educore.edu>',
  },
};

