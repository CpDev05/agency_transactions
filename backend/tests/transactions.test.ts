import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../src/app';
import { TransactionModel } from '../src/modules/transactions/transaction.model';
import type { CreateTransactionData } from '../src/modules/transactions/transaction.service';
import {
  bearer,
  registerUser,
  startTestDatabase,
  stopTestDatabase,
  type TestUser,
} from './helpers';

const validTransaction = {
  description: 'Compra de útiles',
  amount: 25000,
  type: 'expense' as const,
  category: 'Hogar',
  date: '2026-10-01T12:00:00.000Z',
};

let mongod: MongoMemoryServer | undefined;
let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  mongod = await startTestDatabase();
  alice = await registerUser('alice');
  bob = await registerUser('bob');
});

afterAll(async () => {
  await stopTestDatabase(mongod);
});

beforeEach(async () => {
  await TransactionModel.deleteMany({});
});

async function seedTransactionFor(
  userId: string,
  overrides: Partial<CreateTransactionData> = {},
) {
  const data: CreateTransactionData = {
    ...validTransaction,
    date: new Date(validTransaction.date),
    ...overrides,
  };
  return TransactionModel.create({ ...data, userId });
}

describe('POST /api/transactions', () => {
  it('crea una transacción válida y le asigna el usuario autenticado', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(validTransaction);

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe(validTransaction.description);
    expect(res.body.data.amount).toBe(validTransaction.amount);
    expect(res.body.data.type).toBe('expense');
    expect(res.body.data.category).toBe(validTransaction.category);
    expect(res.body.data.userId).toBe(alice.id);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.createdAt).toBeDefined();
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('rechaza montos iguales a cero', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, amount: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza montos negativos', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, amount: -1500 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza tipos inválidos', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, type: 'gasto' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza montos con tipo de dato incorrecto', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, amount: '25000' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza categorías vacías', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, category: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza campos desconocidos distintos de userId', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, propietario: alice.id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza campos obligatorios ausentes', async () => {
    const { description: _description, ...withoutDescription } = validTransaction;
    const res = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(withoutDescription);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('description');
  });

  it('rechaza una fecha inválida', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, date: 'no-es-una-fecha' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza un userId enviado por el cliente en el cuerpo', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, userId: bob.id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await TransactionModel.countDocuments({})).toBe(0);
  });

  it('valida el cuerpo con JSON malformado', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .set('Content-Type', 'application/json')
      .send('{invalido');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('GET /api/transactions', () => {
  it('lista únicamente las transacciones del usuario autenticado', async () => {
    await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(validTransaction);
    await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, description: 'Segunda compra', amount: 1000 });
    await seedTransactionFor(bob.id);

    const res = await request(app).get('/api/transactions').set(bearer(alice.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const ids = res.body.data.map((t: { userId: string }) => t.userId);
    expect(ids).not.toContain(bob.id);
    expect(ids.every((id: string) => id === alice.id)).toBe(true);
  });

  it('filtra por tipo', async () => {
    await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(validTransaction);
    await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({
        ...validTransaction,
        description: 'Salario',
        type: 'income',
        category: 'Trabajo',
        amount: 900000,
      });

    const res = await request(app)
      .get('/api/transactions?type=income')
      .set(bearer(alice.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].type).toBe('income');
  });

  it('filtra por categoría', async () => {
    await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(validTransaction);
    await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, description: 'Transporte', category: 'Movilidad' });

    const res = await request(app)
      .get('/api/transactions?category=Movilidad')
      .set(bearer(alice.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].category).toBe('Movilidad');
  });

  it('filtra por rango de fechas', async () => {
    await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, date: '2026-09-15T00:00:00.000Z' });
    await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, description: 'Octubre', date: '2026-10-15T00:00:00.000Z' });

    const res = await request(app)
      .get('/api/transactions?startDate=2026-10-01&endDate=2026-10-31')
      .set(bearer(alice.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].description).toBe('Octubre');
  });

  it('filtra con un solo extremo del rango de fechas', async () => {
    await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, description: 'Septiembre', date: '2026-09-15T00:00:00.000Z' });
    await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, description: 'Octubre', date: '2026-10-15T00:00:00.000Z' });
    await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, description: 'Noviembre', date: '2026-11-15T00:00:00.000Z' });

    const desde = await request(app)
      .get('/api/transactions?startDate=2026-10-01')
      .set(bearer(alice.token));
    const hasta = await request(app)
      .get('/api/transactions?endDate=2026-10-31')
      .set(bearer(alice.token));

    expect(desde.status).toBe(200);
    expect(desde.body.data).toHaveLength(2);
    expect(hasta.status).toBe(200);
    expect(hasta.body.data).toHaveLength(2);
  });

  it('rechaza un rango de fechas invertido', async () => {
    const res = await request(app)
      .get('/api/transactions?startDate=2026-10-31&endDate=2026-10-01')
      .set(bearer(alice.token));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza valores de filtro inválidos', async () => {
    const res = await request(app)
      .get('/api/transactions?type=otracosa')
      .set(bearer(alice.token));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('los filtros nunca exponen datos de otro usuario', async () => {
    await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send({ ...validTransaction, category: 'Comida' });
    await seedTransactionFor(bob.id, { category: 'Comida', amount: 999 });

    const res = await request(app)
      .get(
        '/api/transactions?type=expense&category=Comida&startDate=2026-10-01&endDate=2026-10-31',
      )
      .set(bearer(alice.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe(alice.id);
  });

  it('ignora un userId en la query y sigue listando solo lo propio', async () => {
    await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(validTransaction);
    await seedTransactionFor(bob.id);

    const res = await request(app)
      .get(`/api/transactions?userId=${bob.id}`)
      .set(bearer(alice.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe(alice.id);
  });

  it('ignora operadores inyectados en la query', async () => {
    await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(validTransaction);
    await seedTransactionFor(bob.id);

    const res = await request(app)
      .get('/api/transactions?type%5B%24ne%5D=expense')
      .set(bearer(alice.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe(alice.id);
  });
});

describe('GET /api/transactions/:id', () => {
  it('consulta una transacción existente propia', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(validTransaction);

    const res = await request(app)
      .get(`/api/transactions/${created.body.data._id}`)
      .set(bearer(alice.token));

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(created.body.data._id);
    expect(res.body.data.description).toBe(validTransaction.description);
  });

  it('rechaza identificadores con formato inválido', async () => {
    const res = await request(app)
      .get('/api/transactions/no-es-un-id')
      .set(bearer(alice.token));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('devuelve 404 para un identificador inexistente', async () => {
    const res = await request(app)
      .get('/api/transactions/000000000000000000000000')
      .set(bearer(alice.token));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('devuelve 404 para transacciones de otro usuario', async () => {
    const foreign = await seedTransactionFor(bob.id);

    const res = await request(app)
      .get(`/api/transactions/${foreign._id}`)
      .set(bearer(alice.token));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /api/transactions/:id', () => {
  it('actualiza campos de una transacción propia', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(validTransaction);

    const res = await request(app)
      .patch(`/api/transactions/${created.body.data._id}`)
      .set(bearer(alice.token))
      .send({ amount: 30000, description: 'Compra corregida' });

    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(30000);
    expect(res.body.data.description).toBe('Compra corregida');
    expect(res.body.data.category).toBe(validTransaction.category);

    const stored = await TransactionModel.findById(created.body.data._id);
    expect(stored?.amount).toBe(30000);
  });

  it('rechaza un cuerpo de actualización vacío', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(validTransaction);

    const res = await request(app)
      .patch(`/api/transactions/${created.body.data._id}`)
      .set(bearer(alice.token))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza montos inválidos en la actualización', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(validTransaction);

    const res = await request(app)
      .patch(`/api/transactions/${created.body.data._id}`)
      .set(bearer(alice.token))
      .send({ amount: -10 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza identificadores inválidos', async () => {
    const res = await request(app)
      .patch('/api/transactions/malo')
      .set(bearer(alice.token))
      .send({ amount: 10 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('no permite cambiar el propietario mediante PATCH', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(validTransaction);

    const res = await request(app)
      .patch(`/api/transactions/${created.body.data._id}`)
      .set(bearer(alice.token))
      .send({ userId: bob.id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    const stored = await TransactionModel.findById(created.body.data._id);
    expect(String(stored?.userId)).toBe(alice.id);
  });

  it('rechaza valores inválidos en actualizaciones parciales', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(validTransaction);

    const patches: Array<Record<string, unknown>> = [
      { type: 'gasto' },
      { amount: '100' },
      { category: '   ' },
      { date: 'no-es-fecha' },
    ];

    for (const patch of patches) {
      const res = await request(app)
        .patch(`/api/transactions/${created.body.data._id}`)
        .set(bearer(alice.token))
        .send(patch);

      expect(res.status, JSON.stringify(patch)).toBe(400);
      expect(res.body.error.code, JSON.stringify(patch)).toBe('VALIDATION_ERROR');
    }
  });

  it('devuelve 404 al actualizar una transacción inexistente', async () => {
    const res = await request(app)
      .patch('/api/transactions/000000000000000000000000')
      .set(bearer(alice.token))
      .send({ amount: 10 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('devuelve 404 al actualizar una transacción ajena', async () => {
    const foreign = await seedTransactionFor(bob.id);

    const res = await request(app)
      .patch(`/api/transactions/${foreign._id}`)
      .set(bearer(alice.token))
      .send({ amount: 999999 });

    expect(res.status).toBe(404);

    const stored = await TransactionModel.findById(foreign._id);
    expect(stored?.amount).toBe(validTransaction.amount);
  });
});

describe('DELETE /api/transactions/:id', () => {
  it('elimina una transacción propia y deja de servirla', async () => {
    const created = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(validTransaction);

    const del = await request(app)
      .delete(`/api/transactions/${created.body.data._id}`)
      .set(bearer(alice.token));
    expect(del.status).toBe(204);
    expect(del.body).toEqual({});

    const after = await request(app)
      .get(`/api/transactions/${created.body.data._id}`)
      .set(bearer(alice.token));
    expect(after.status).toBe(404);
    expect(await TransactionModel.countDocuments({})).toBe(0);
  });

  it('devuelve 404 al eliminar una transacción ajena sin borrarla', async () => {
    const foreign = await seedTransactionFor(bob.id);

    const res = await request(app)
      .delete(`/api/transactions/${foreign._id}`)
      .set(bearer(alice.token));

    expect(res.status).toBe(404);
    expect(await TransactionModel.countDocuments({ _id: foreign._id })).toBe(1);
  });

  it('rechaza identificadores inválidos', async () => {
    const res = await request(app)
      .delete('/api/transactions/123')
      .set(bearer(alice.token));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('devuelve 404 al eliminar una transacción inexistente', async () => {
    const res = await request(app)
      .delete('/api/transactions/000000000000000000000000')
      .set(bearer(alice.token));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('aislamiento entre usuarios autenticados', () => {
  it('no permite consultar, actualizar ni eliminar datos de otro usuario', async () => {
    const foreign = await seedTransactionFor(bob.id, { amount: 777 });

    const get = await request(app)
      .get(`/api/transactions/${foreign._id}`)
      .set(bearer(alice.token));
    const patch = await request(app)
      .patch(`/api/transactions/${foreign._id}`)
      .set(bearer(alice.token))
      .send({ amount: 1 });
    const del = await request(app)
      .delete(`/api/transactions/${foreign._id}`)
      .set(bearer(alice.token));
    const list = await request(app).get('/api/transactions').set(bearer(alice.token));

    expect(get.status).toBe(404);
    expect(patch.status).toBe(404);
    expect(del.status).toBe(404);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(0);

    const stored = await TransactionModel.findById(foreign._id);
    expect(stored?.amount).toBe(777);
    expect(String(stored?.userId)).toBe(bob.id);
  });

  it('ignora un token de otro usuario para modificar datos propios ajenos', async () => {
    const mias = await request(app)
      .post('/api/transactions')
      .set(bearer(alice.token))
      .send(validTransaction);
    const deBob = await seedTransactionFor(bob.id, { amount: 555 });

    // Bob usa su propio token (válido) sobre una transacción de Alice
    const res = await request(app)
      .patch(`/api/transactions/${mias.body.data._id}`)
      .set(bearer(bob.token))
      .send({ amount: 1 });

    expect(res.status).toBe(404);

    const stored = await TransactionModel.findById(mias.body.data._id);
    expect(stored?.amount).toBe(validTransaction.amount);
    expect(String(stored?.userId)).toBe(alice.id);

    const bobStored = await TransactionModel.findById(deBob._id);
    expect(bobStored?.amount).toBe(555);
  });
});
