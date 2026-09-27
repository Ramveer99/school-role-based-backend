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
    if (fs.existsSync(path.join(frontendPath, 'index.html'))) {
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
    res.redirect(302, '/web/favicon.svg');
  });

  app.use('/api', apiRoutes);

  app.use('/web', express.static(frontendPath));
  app.get('/web/*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
