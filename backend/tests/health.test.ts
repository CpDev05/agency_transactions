import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('GET /api/health', () => {
  it('responde 200 con el envolvente de datos', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.uptime).toBe('number');
    expect(typeof res.body.data.timestamp).toBe('string');
  });

  it('no expone el encabezado X-Powered-By', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('incluye las cabeceras de seguridad de Helmet', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    // La CSP está desactivada a propósito: la API solo devuelve JSON
    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  it('responde sin exigir autenticación', async () => {
    const res = await request(app).get('/api/health').set('Authorization', 'Bearer invalido');

    expect(res.status).toBe(200);
  });

  it('devuelve 404 con envolvente de error para rutas desconocidas', async () => {
    const res = await request(app).get('/api/desconocida');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
