import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { UserModel } from '../src/modules/auth/auth.model';
import { TransactionModel } from '../src/modules/transactions/transaction.model';
import {
  bearer,
  registerUser,
  startTestDatabase,
  stopTestDatabase,
  TEST_PASSWORD,
} from './helpers';

function uniqueEmail(tag: string): string {
  return `${tag}-${randomUUID().slice(0, 8)}@test.local`;
}

let mongod: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongod = await startTestDatabase();
});

afterAll(async () => {
  await stopTestDatabase(mongod);
});

beforeEach(async () => {
  await TransactionModel.deleteMany({});
  await UserModel.deleteMany({});
});

describe('POST /api/auth/register', () => {
  it('registra un usuario, devuelve user + accessToken y no expone el hash', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Ana Pérez',
      email: uniqueEmail('registro'),
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.id).toBeDefined();
    expect(res.body.data.user.name).toBe('Ana Pérez');
    expect(res.body.data.user.email).toContain('@test.local');
    expect(typeof res.body.data.accessToken).toBe('string');

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('password');
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain(TEST_PASSWORD);

    const stored = await UserModel.findById(res.body.data.user.id).select('+passwordHash');
    expect(stored).not.toBeNull();
    expect(stored?.passwordHash).not.toBe(TEST_PASSWORD);
  });

  it('normaliza el correo a minúsculas', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Ana Mayúsculas',
      email: uniqueEmail('MAYUSCULA'),
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(res.body.data.user.email.toLowerCase());
  });

  it('recorta los espacios del nombre', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: '   Ana con espacios   ',
      email: uniqueEmail('trim'),
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.name).toBe('Ana con espacios');
  });

  it('devuelve 409 al registrar un correo duplicado (ignorando mayúsculas)', async () => {
    const email = uniqueEmail('dup');
    const first = await request(app).post('/api/auth/register').send({
      name: 'Primera',
      email: email.toUpperCase(),
      password: TEST_PASSWORD,
    });
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/auth/register').send({
      name: 'Segunda',
      email: email.toLowerCase(),
      password: TEST_PASSWORD,
    });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');
  });

  it('valida los campos del registro', async () => {
    const cases: Array<{ label: string; payload: Record<string, unknown>; field: string }> = [
      { label: 'email inválido', payload: { name: 'A', email: 'no-es-correo', password: TEST_PASSWORD }, field: 'email' },
      { label: 'password corta', payload: { name: 'A', email: uniqueEmail('corta'), password: '1234567' }, field: 'password' },
      { label: 'name vacío', payload: { name: '   ', email: uniqueEmail('sinname'), password: TEST_PASSWORD }, field: 'name' },
      {
        label: 'campo extra',
        payload: { name: 'A', email: uniqueEmail('extra'), password: TEST_PASSWORD, role: 'admin' },
        field: 'role',
      },
    ];

    for (const { label, payload, field } of cases) {
      const res = await request(app).post('/api/auth/register').send(payload);
      expect(res.status, label).toBe(400);
      expect(res.body.error.code, label).toBe('VALIDATION_ERROR');
      expect(res.body.error.message, label).toContain(field);
    }
  });

  it('rechaza un registro sin cuerpo', async () => {
    const res = await request(app).post('/api/auth/register');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login', () => {
  it('autentica con credenciales válidas y devuelve un token', async () => {
    const email = uniqueEmail('login');
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Login OK', email, password: TEST_PASSWORD });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: email.toUpperCase(), password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(email.toLowerCase());
    expect(typeof res.body.data.accessToken).toBe('string');
  });

  it('rechaza la contraseña incorrecta con 401', async () => {
    const email = uniqueEmail('mala-pass');
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Mala pass', email, password: TEST_PASSWORD });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'otra-contrasena' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rechaza un correo inexistente con 401 (mismo mensaje)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: uniqueEmail('fantasma'),
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Credenciales inválidas');
  });

  it('valida el payload del login', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'no-correo' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('no expone contraseña ni hash en la respuesta del login', async () => {
    const email = uniqueEmail('login-leak');
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sin fuga', email, password: TEST_PASSWORD });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain(TEST_PASSWORD);
  });

  it('rechaza un password de login que supera el límite de bcrypt', async () => {
    const email = uniqueEmail('largo');
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Largo', email, password: TEST_PASSWORD });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'a'.repeat(73) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/me', () => {
  it('devuelve el perfil del usuario autenticado', async () => {
    const user = await registerUser('me');

    const res = await request(app).get('/api/auth/me').set(bearer(user.token));

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.email).toBe(user.email);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('devuelve 401 sin token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('acepta el esquema Bearer sin distinguir mayúsculas', async () => {
    const user = await registerUser('bearer-minusculas');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
  });

  it('devuelve 401 con un token firmado con otro algoritmo', async () => {
    const user = await registerUser('otro-algoritmo');
    const forged = jwt.sign({ sub: user.id }, env.JWT_SECRET, {
      algorithm: 'HS512',
      expiresIn: '1h',
    });

    const res = await request(app).get('/api/auth/me').set(bearer(forged));

    expect(res.status).toBe(401);
  });

  it('devuelve 401 con un token firmado con otro secreto', async () => {
    const user = await registerUser('otro-secreto');
    const forged = jwt.sign({ sub: user.id }, 'secreto-completamente-diferente-0123456789', {
      algorithm: 'HS256',
      expiresIn: '1h',
    });

    const res = await request(app).get('/api/auth/me').set(bearer(forged));

    expect(res.status).toBe(401);
  });

  it('devuelve 401 con un token expirado', async () => {
    const user = await registerUser('expirado');
    const expired = jwt.sign(
      { sub: user.id, iat: Math.floor(Date.now() / 1000) - 7200, exp: Math.floor(Date.now() / 1000) - 3600 },
      env.JWT_SECRET,
      { algorithm: 'HS256' },
    );

    const res = await request(app).get('/api/auth/me').set(bearer(expired));

    expect(res.status).toBe(401);
  });

  it('devuelve 401 con un token cuyo payload no tiene sub', async () => {
    const noSub = jwt.sign({ otro: 'campo' }, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });

    const res = await request(app).get('/api/auth/me').set(bearer(noSub));

    expect(res.status).toBe(401);
  });

  it('devuelve 401 si el usuario fue eliminado tras emitir el token', async () => {
    const user = await registerUser('borrado');
    await UserModel.deleteOne({ _id: user.id });

    const res = await request(app).get('/api/auth/me').set(bearer(user.token));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('devuelve 401 si el sub del token no es un ObjectId válido', async () => {
    const token = jwt.sign({ sub: 'no-es-un-objectid' }, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });

    const res = await request(app).get('/api/auth/me').set(bearer(token));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rechaza operaciones con el token de un usuario eliminado', async () => {
    const user = await registerUser('borrado-tx');
    const created = await request(app)
      .post('/api/transactions')
      .set(bearer(user.token))
      .send({
        description: 'Cena',
        amount: 25,
        type: 'expense',
        category: 'comida',
        date: '2026-01-15T12:00:00.000Z',
      });
    expect(created.status).toBe(201);

    await UserModel.deleteOne({ _id: user.id });

    const list = await request(app).get('/api/transactions').set(bearer(user.token));

    expect(list.status).toBe(401);
    expect(list.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('flujo completo de aislamiento con dos usuarios reales', () => {
  it('el token de un usuario no da acceso a las transacciones del otro', async () => {
    const ana = await registerUser('ana');
    const luis = await registerUser('luis');

    const created = await request(app)
      .post('/api/transactions')
      .set(bearer(ana.token))
      .send({
        description: 'Nómina',
        amount: 1500000,
        type: 'income',
        category: 'Trabajo',
        date: '2026-10-05T00:00:00.000Z',
      });
    expect(created.status).toBe(201);
    expect(created.body.data.userId).toBe(ana.id);

    const listAna = await request(app).get('/api/transactions').set(bearer(ana.token));
    const listLuis = await request(app).get('/api/transactions').set(bearer(luis.token));

    expect(listAna.body.data).toHaveLength(1);
    expect(listLuis.body.data).toHaveLength(0);

    const getLuis = await request(app)
      .get(`/api/transactions/${created.body.data._id}`)
      .set(bearer(luis.token));
    expect(getLuis.status).toBe(404);
  });
});
