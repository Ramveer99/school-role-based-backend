import path from 'node:path';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import apiRoutes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { env } from './config/env.js';
import { setupSwagger } from './config/swagger.js';
import { uploadsRoot } from './utils/avatarStorage.js';

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

  if (!env.serveStatic || env.nodeEnv === 'test') {
    app.get('/', (_req, res) => {
      res.json({
        name: 'EduCore School Dashboard API',
        version: '1.0.0',
        database: 'mongodb',
        health: '/api/health',
        docs: '/api/docs',
      });
    });
  }

  app.use('/api', apiRoutes);

  if (env.serveStatic && env.nodeEnv !== 'test') {
    app.use(express.static(env.staticDir, { index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.sendFile(path.join(env.staticDir, 'index.html'), (err) => {
        if (err) next(err);
      });
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
