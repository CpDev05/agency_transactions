import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { LOGIN_RATE_LIMIT_MESSAGE } from '../src/middlewares/rate-limit.middleware';

const MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX);

// Payload inválido: el limitador cuenta el intento y el controlador responde 400
// sin tocar la base de datos (así la prueba es rápida y aislada).
const invalidLogin = { email: 'no-es-un-correo' };

describe('rate limiting de POST /api/auth/login', () => {
  it('devuelve 429 con el envolvente de error al superar el límite', async () => {
    expect(MAX).toBeGreaterThan(0);

    for (let attempt = 1; attempt <= MAX; attempt += 1) {
      const res = await request(app).post('/api/auth/login').send(invalidLogin);
      expect(res.status, `intento ${attempt} de ${MAX}`).toBe(400);
    }

    const blocked = await request(app).post('/api/auth/login').send(invalidLogin);

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(blocked.body.error.message).toBe(LOGIN_RATE_LIMIT_MESSAGE);
    expect(blocked.body.data).toBeUndefined();
    expect(blocked.headers['ratelimit']).toBeDefined();

    // El bloqueo se mantiene mientras dure la ventana
    const again = await request(app).post('/api/auth/login').send(invalidLogin);
    expect(again.status).toBe(429);
  });

  it('no limita rutas ajenas al login', async () => {
    const health = await request(app).get('/api/health');
    const register = await request(app).post('/api/auth/register').send({});

    expect(health.status).toBe(200);
    expect(register.status).toBe(400);
  });
});
