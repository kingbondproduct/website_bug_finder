import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { crawlRoutes } from './routes/crawls.js';
import { disconnectDb } from './db.js';

async function main(): Promise<void> {
  const app = Fastify({ logger: { level: 'info' } });

  await app.register(cors, { origin: true });

  // Serve full-page screenshots written by the crawler.
  const screenshotDir = path.join(process.cwd(), config.dataDir, 'screenshots');
  mkdirSync(screenshotDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: screenshotDir,
    prefix: '/screenshots/',
    decorateReply: false,
  });

  app.get('/api/health', async () => ({ ok: true }));
  await app.register(crawlRoutes, { prefix: '/api' });

  const shutdown = async () => {
    await app.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`Bug-finder API listening on http://localhost:${config.port}`);
}

main().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
