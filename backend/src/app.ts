import cors, { type CorsOptions } from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env, type Env } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { authRouter } from './modules/auth/auth.routes';
import { transactionRouter } from './modules/transactions/transaction.routes';
import { sendData } from './utils/responses';

export const app = express();

app.disable('x-powered-by');

// Cabeceras de seguridad. La API solo sirve JSON: la CSP (pensada para HTML)
// se desactiva y el resto de protecciones (nosniff, frameguard, HSTS,
// referrer-policy, CORP...) se mantienen con los valores por defecto de Helmet.
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

/**
 * CORS:
 * - Con `CORS_ORIGIN` definido solo se permite ese origen.
 * - En desarrollo/test sin configurar se permite cualquier origen (comodidad local).
 * - En producción sin `CORS_ORIGIN` no se habilitan cabeceras CORS (mismo origen).
 */
export function resolveCorsOptions(
  origin: string | undefined,
  nodeEnv: Env['NODE_ENV'],
): CorsOptions | null {
  if (origin) {
    return { origin };
  }
  return nodeEnv === 'production' ? null : {};
}

const corsOptions = resolveCorsOptions(env.CORS_ORIGIN, env.NODE_ENV);
if (corsOptions) {
  app.use(cors(corsOptions));
}
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  sendData(res, {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/transactions', transactionRouter);

app.use(notFoundHandler);
app.use(errorHandler);
