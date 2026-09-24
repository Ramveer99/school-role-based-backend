import '../src/config/env.js';
import { env } from '../src/config/env.js';
import mongoose from 'mongoose';

await mongoose.connect(env.mongodbUri);
const client = mongoose.connection.client;
const { databases } = await client.db().admin().command({ listDatabases: 1 });

console.log('Configured MONGODB_URI:', env.mongodbUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@'));

for (const d of databases) {
  if (!/school/i.test(d.name)) continue;
  const db = client.db(d.name);
  const cols = await db.listCollections().toArray();
  let total = 0;
  console.log(`\n=== ${d.name} ===`);
  for (const c of cols.sort((a, b) => a.name.localeCompare(b.name))) {
    const n = await db.collection(c.name).countDocuments();
    total += n;
    console.log(`  ${c.name}: ${n}`);
  }
  console.log(`  Total documents: ${total}`);
}

await mongoose.disconnect();
