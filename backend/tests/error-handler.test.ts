import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../src/config/env';
import { errorHandler, notFoundHandler } from '../src/middlewares/error.middleware';
import { HttpError } from '../src/utils/httpError';

interface Captured {
  status?: number;
  body?: unknown;
}

function fakeResponse(): { res: Response; captured: Captured } {
  const captured: Captured = {};
  const res = {
    status(code: number) {
      captured.status = code;
      return res;
    },
    json(body: unknown) {
      captured.body = body;
      return res;
    },
  } as unknown as Response;
  return { res, captured };
}

function runHandler(err: unknown): Captured {
  const { res, captured } = fakeResponse();
  errorHandler(err, {} as Request, res, (() => undefined) as NextFunction);
  return captured;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('manejador central de errores', () => {
  it('traduce un ZodError a 400 VALIDATION_ERROR', () => {
    const parsed = z.object({ amount: z.number() }).safeParse({ amount: 'no-numero' });
    if (parsed.success) throw new Error('se esperaba un fallo de validación');

    const captured = runHandler(parsed.error);

    expect(captured.status).toBe(400);
    expect(captured.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(JSON.stringify(captured.body)).toContain('amount');
  });

  it('respeta el status y código de un HttpError', () => {
    const captured = runHandler(new HttpError(404, 'NOT_FOUND', 'Transacción no encontrada'));

    expect(captured.status).toBe(404);
    expect(captured.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Transacción no encontrada' },
    });
  });

  it('mapea errores con status 4xx (p. ej. body-parser) sin ocultar el detalle', () => {
    const error = Object.assign(new Error('JSON inválido'), { status: 400 });

    const captured = runHandler(error);

    expect(captured.status).toBe(400);
    expect(captured.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'JSON inválido' } });
  });

  it('traduce un CastError de Mongoose a 400 INVALID_ID', () => {
    const error = Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' });

    const captured = runHandler(error);

    expect(captured.status).toBe(400);
    expect(captured.body).toEqual({
      error: { code: 'INVALID_ID', message: 'Identificador inválido' },
    });
  });

  it('traduce un ValidationError de Mongoose a 400 VALIDATION_ERROR', () => {
    const error = Object.assign(new Error('Validation failed'), {
      name: 'ValidationError',
      errors: { amount: { message: 'amount debe ser mayor que 0' } },
    });

    const captured = runHandler(error);

    expect(captured.status).toBe(400);
    expect(captured.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'amount debe ser mayor que 0' },
    });
  });

  it('oculta detalles internos y stacks en producción', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const previous = env.NODE_ENV;
    env.NODE_ENV = 'production';

    try {
      const captured = runHandler(new Error('fallo interno con detalle sensible'));

      expect(captured.status).toBe(500);
      expect(captured.body).toEqual({
        error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      });
      const raw = JSON.stringify(captured.body);
      expect(raw).not.toContain('detalle sensible');
      expect(raw).not.toContain('stack');
      expect(raw).not.toContain('at ');
    } finally {
      env.NODE_ENV = previous;
    }
  });

  it('devuelve 500 envolvente ante un error desconocido', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const captured = runHandler(new Error('algo falló'));

    expect(captured.status).toBe(500);
    expect(captured.body).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
  });
});

describe('manejador de rutas desconocidas', () => {
  it('responde 404 con el envolvente de error', () => {
    const { res, captured } = fakeResponse();
    const req = { method: 'GET', path: '/api/desconocida' } as unknown as Request;

    notFoundHandler(req, res, (() => undefined) as NextFunction);

    expect(captured.status).toBe(404);
    expect(captured.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Ruta no encontrada: GET /api/desconocida' },
    });
  });
});
