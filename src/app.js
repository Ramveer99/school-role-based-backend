import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import apiRoutes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { env } from './config/env.js';
import { setupSwagger } from './config/swagger.js';
import { uploadsRoot } from './utils/avatarStorage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendPath = path.resolve(__dirname, '..', 'dist', 'web');
const frontendIndex = path.join(frontendPath, 'index.html');
const hasFrontend = fs.existsSync(frontendIndex);

function sendFrontendIndex(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  res.sendFile(frontendIndex, (err) => {
    if (err) next(err);
  });
}

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin === 'true' || env.corsOrigin === true ? true : env.corsOrigin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );
  app.use(express.json({ limit: '3mb' }));
  app.use('/uploads', express.static(uploadsRoot));
  if (env.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  // Swagger Documentation
  setupSwagger(app);

  app.get('/', (_req, res) => {
    if (hasFrontend) {
      return res.redirect(302, '/web/');
    }

    res.json({
      name: 'EduCore School Dashboard API',
      version: '1.0.0',
      database: 'mongodb',
      health: '/api/health',
      docs: '/api/docs',
    });
  });

  app.get('/favicon.ico', (_req, res) => {
    if (hasFrontend) {
      return res.redirect(302, '/web/favicon.svg');
    }
    res.status(404).end();
  });

  app.use('/api', apiRoutes);

  if (hasFrontend) {
    app.use('/web', express.static(frontendPath, { index: 'index.html' }));
    app.get('/web', (_req, res) => res.redirect(301, '/web/'));
    app.get('/web/', sendFrontendIndex);
    app.get('/web/*', (req, res, next) => {
      const lastSegment = req.path.split('/').pop() || '';
      if (path.extname(lastSegment)) return next();
      sendFrontendIndex(req, res, next);
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
