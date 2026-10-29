import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

function expectUnauthorized(res: { status: number; body: { error: { code: string } } }): void {
  expect(res.status).toBe(401);
  expect(res.body.error.code).toBe('UNAUTHORIZED');
}

describe('acceso sin token de autenticación', () => {
  it('rechaza GET /api/transactions con 401', async () => {
    const res = await request(app).get('/api/transactions');
    expectUnauthorized(res);
  });

  it('rechaza POST /api/transactions con 401', async () => {
    const res = await request(app).post('/api/transactions').send({
      description: 'No debería crearse',
      amount: 1000,
      type: 'income',
      category: 'Test',
      date: '2026-10-01T00:00:00.000Z',
    });
    expectUnauthorized(res);
  });

  it('rechaza GET /api/transactions/:id con 401', async () => {
    const res = await request(app).get('/api/transactions/000000000000000000000000');
    expectUnauthorized(res);
  });

  it('rechaza PATCH /api/transactions/:id con 401', async () => {
    const res = await request(app)
      .patch('/api/transactions/000000000000000000000000')
      .send({ amount: 1 });
    expectUnauthorized(res);
  });

  it('rechaza DELETE /api/transactions/:id con 401', async () => {
    const res = await request(app).delete('/api/transactions/000000000000000000000000');
    expectUnauthorized(res);
  });
});

describe('acceso con credenciales malformadas', () => {
  it('rechaza un header Authorization sin esquema Bearer', async () => {
    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', 'token sin formato');
    expectUnauthorized(res);
  });

  it('rechaza un Bearer con token vacío', async () => {
    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', 'Bearer ');
    expectUnauthorized(res);
  });

  it('rechaza un token que no es un JWT', async () => {
    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', 'Bearer no-es-un-jwt');
    expectUnauthorized(res);
  });
});
