import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  // 0.0.0.0 permite aceptar conexiones desde fuera del contenedor Docker
  HOST: z.string().min(1).default('0.0.0.0'),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI es obligatoria')
    .regex(/^mongodb(\+srv)?:\/\//, 'MONGODB_URI debe empezar por mongodb:// o mongodb+srv://'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  // Duración explícita del access token (formato con unidad: 15m, 1h, 7d)
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhdw]$/, 'JWT_EXPIRES_IN debe ser una duración con unidad (p. ej. 15m, 1h, 7d)')
    .default('1h'),
  CORS_ORIGIN: z.url().optional(),
  // Límite de intentos de login por IP (por defecto: 10 cada 15 minutos)
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(15 * 60 * 1000),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Variables de entorno inválidas:\n${issues}\n` +
        'Copia backend/.env.example a backend/.env y completa los valores.',
    );
  }

  return parsed.data;
}

export const env = parseEnv(process.env);
