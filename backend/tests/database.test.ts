import { afterAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { closeDatabase, connectDatabase } from '../src/config/database';

let mongod: MongoMemoryServer | undefined;

afterAll(async () => {
  await closeDatabase().catch(() => undefined);
  if (mongod) {
    await mongod.stop();
  }
});

describe('conexión a MongoDB', () => {
  it('conecta con una URI válida y se desconecta limpiamente', async () => {
    mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });

    await connectDatabase(mongod.getUri('agency_transactions_db_test'));
    expect(mongoose.connection.readyState).toBe(1);

    await closeDatabase();
    expect(mongoose.connection.readyState).toBe(0);
  });
});
