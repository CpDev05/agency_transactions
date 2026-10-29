import type { Request } from 'express';
import { unauthorized } from '../utils/httpError';

export interface AuthUser {
  id: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Resuelve el propietario de los datos de la petición.
 *
 * Única fuente: `req.user`, inyectado por el middleware JWT (`requireAuth`).
 * Nunca se leen identificadores del cliente: un `userId` enviado en body,
 * query o params queda descartado y no participa en esta resolución.
 */
export function resolveOwnerId(req: Request): string | null {
  return req.user?.id ?? null;
}

export function requireUserId(req: Request): string {
  const id = resolveOwnerId(req);
  if (!id) {
    throw unauthorized('Autenticación requerida');
  }
  return id;
}
