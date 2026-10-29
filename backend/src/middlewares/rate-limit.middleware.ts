import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { sendError } from '../utils/responses';

export interface LoginRateLimitOptions {
  limit: number;
  windowMs: number;
}

export const LOGIN_RATE_LIMIT_MESSAGE =
  'Demasiados intentos de inicio de sesión. Inténtalo de nuevo más tarde.';

/**
 * Limita los intentos de login por IP (ventana deslizante) y responde 429 con
 * el mismo envolvente de error del resto de la API.
 */
export function createLoginRateLimiter(
  options: LoginRateLimitOptions = {
    limit: env.LOGIN_RATE_LIMIT_MAX,
    windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
  },
) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Cuentan todos los intentos (válidos y fallidos) para frenar fuerza bruta
    handler: (_req, res) => {
      sendError(res, 429, 'TOO_MANY_REQUESTS', LOGIN_RATE_LIMIT_MESSAGE);
    },
  });
}

export const loginRateLimiter = createLoginRateLimiter();
