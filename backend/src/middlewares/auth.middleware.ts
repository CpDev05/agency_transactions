import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import { env } from '../config/env';
import { UserModel } from '../modules/auth/auth.model';
import { unauthorized } from '../utils/httpError';

/**
 * Verifica el token JWT enviado en `Authorization: Bearer <token>` y
 * establece la identidad autenticada en `req.user` (ver owner.middleware).
 *
 * Además de la firma, comprueba que el usuario sigue existiendo: un token
 * vigente de una cuenta eliminada no debe autorizar operaciones.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  // El esquema HTTP es insensible a mayúsculas (RFC 7235); se toleran espacios extra.
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  const token = match?.[1];
  if (!token) {
    next(unauthorized('Token de autenticación requerido'));
    return;
  }

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    next(unauthorized('Token inválido o expirado'));
    return;
  }

  const userId = typeof payload === 'string' ? undefined : payload.sub;
  if (typeof userId !== 'string' || !isValidObjectId(userId)) {
    next(unauthorized('Token inválido'));
    return;
  }

  try {
    // Consulta al índice _id: coste bajo y evita autorizar cuentas borradas
    const exists = await UserModel.exists({ _id: userId });
    if (!exists) {
      next(unauthorized('Token inválido'));
      return;
    }

    req.user = { id: userId };
    next();
  } catch (err) {
    // Fallos de base de datos se manejan como 500 en el middleware central
    next(err);
  }
};
