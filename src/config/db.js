import mongoose from 'mongoose';
import { env } from './env.js';

let memServer = null;

export async function connectDb(customUri = null) {
  mongoose.set('strictQuery', true);
  const targetUri = customUri || env.mongodbUri;

  try {
    await mongoose.connect(targetUri, { serverSelectionTimeoutMS: 2500 });
    const safeUri = targetUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
    console.log(`[backend] MongoDB connected: ${safeUri}`);
  } catch (err) {
    if (
      env.nodeEnv !== 'production' &&
      (err.name === 'MongooseServerSelectionError' || err.message?.includes('ECONNREFUSED'))
    ) {
      console.warn(`[backend] Local MongoDB not reachable at ${targetUri}. Starting in-memory Mongo server...`);
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memServer = await MongoMemoryServer.create();
      const memUri = memServer.getUri();
      await mongoose.connect(memUri);
      console.log(`[backend] In-memory MongoDB connected at: ${memUri}`);
    } else {
      throw err;
    }
  }
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memServer) {
    await memServer.stop();
    memServer = null;
  }
}

export default connectDb;
