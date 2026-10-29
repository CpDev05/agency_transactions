import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError';
import { sendError } from '../utils/responses';
import { env } from '../config/env';

const STATUS_CODES_MAP: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  500: 'INTERNAL_ERROR',
};

const INTERNAL_MESSAGE = 'Error interno del servidor';

//funcion para convertir un error de Zod en un mensaje legible
function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join(' | ');
}

//funcion para decidir el estado HTTP en la respuesta apartir del error
function resolveStatus(err: unknown): number {
  if (err instanceof HttpError) {
    return err.status;
  }
  if (typeof err === 'object' && err !== null) {
    const candidate = err as { status?: unknown; statusCode?: unknown };
    const status = typeof candidate.status === 'number' ? candidate.status : candidate.statusCode;
    if (typeof status === 'number' && status >= 400 && status <= 599) {
      return status;
    }
  }
  return 500;
}

//manejador de rutas no encontradas
export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, 'NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.path}`);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    sendError(res, 400, 'VALIDATION_ERROR', formatZodError(err));
    return;
  }

  if (typeof err === 'object' && err !== null && err.name === 'CastError') {
    sendError(res, 400, 'INVALID_ID', 'Identificador inválido');
    return;
  }

  if (typeof err === 'object' && err !== null && err.name === 'ValidationError') {
    const errors = (err as { errors?: Record<string, { message?: string }> }).errors;
    const details =
      typeof errors === 'object' && errors !== null
        ? Object.values(errors)
            .map((e) => e.message ?? 'valor inválido')
            .join(' | ')
        : 'Error de validación';
    sendError(res, 400, 'VALIDATION_ERROR', details);
    return;
  }

  const status = resolveStatus(err);

  if (status >= 500) {
    console.error(err);
  }

  const code =
    err instanceof HttpError ? err.code : (STATUS_CODES_MAP[status] ?? 'INTERNAL_ERROR');
  const message =
    status >= 500 && env.NODE_ENV === 'production'
      ? INTERNAL_MESSAGE
      : err instanceof Error && err.message
        ? err.message
        : INTERNAL_MESSAGE;

  sendError(res, status, code, message);
};
