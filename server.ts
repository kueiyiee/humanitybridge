import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './src/server/app';
import { env } from './src/server/config/env';
import { logger } from './src/server/config/logger';
import { seedIfEmpty } from './database/seeds/seed';

async function startServer() {
  await seedIfEmpty().catch((err) => {
    logger.warn('Auto-seed skipped or deferred', { error: err instanceof Error ? err.message : String(err) });
  });

  const app = createApiApp();

  if (env.isProduction) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        const template = fs.readFileSync(indexPath, 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        next(err);
      }
    });
  }

  app.listen(env.port, '0.0.0.0', () => {
    logger.info(`HumanityBridge full-stack platform running on http://0.0.0.0:${env.port}`);
  });
}

startServer();
