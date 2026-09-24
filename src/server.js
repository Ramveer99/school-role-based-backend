import './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';
import { env } from './config/env.js';

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[backend] http://localhost:${env.port}`);
    console.log('[backend] MongoDB connected');
    console.log(`[backend] Health: http://localhost:${env.port}/api/health`);
  });
}

main().catch((err) => {
  console.error('[backend] failed to start', err);
  process.exit(1);
});
