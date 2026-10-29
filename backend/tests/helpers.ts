import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../src/app';

export const TEST_PASSWORD = 'contrasena-segura-1';

export interface TestUser {
  id: string;
  name: string;
  email: string;
  token: string;
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

// Registra un usuario real vía la API y devuelve su token de acceso
export async function registerUser(tag: string): Promise<TestUser> {
  const email = `${tag}-${randomUUID().slice(0, 8)}@test.local`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: `Usuario ${tag}`, email, password: TEST_PASSWORD });

  if (res.status !== 201) {
    throw new Error(`register falló (${res.status}): ${JSON.stringify(res.body)}`);
  }

  return {
    id: res.body.data.user.id,
    name: res.body.data.user.name,
    email: res.body.data.user.email,
    token: res.body.data.accessToken,
  };
}

export async function startTestDatabase(): Promise<MongoMemoryServer> {
  // Margen amplio: el arranque puede ser lento en discos virtualizados
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  await mongoose.connect(mongod.getUri('agency_transactions_test'));
  return mongod;
}

export async function stopTestDatabase(mongod: MongoMemoryServer | undefined): Promise<void> {
  await mongoose.disconnect().catch(() => undefined);
  if (mongod) {
    await mongod.stop();
  }
}
