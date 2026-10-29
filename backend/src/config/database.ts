import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('error', (err: Error) => {
    console.error(`MongoDB error de conexión: ${err.message}`);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB desconectado');
  });

  // Fallo rápido y explícito si la base obligatoria no está disponible
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

export async function closeDatabase(): Promise<void> {
  await mongoose.disconnect();
}
