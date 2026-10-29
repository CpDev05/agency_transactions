import { z } from 'zod';

export const registerSchema = z.strictObject({
  name: z.string().trim().min(1, 'name no puede estar vacío').max(100),
  email: z.email({ error: 'correo electrónico inválido' }).max(254),
  // bcrypt trunca a 72 bytes como máximo
  password: z
    .string()
    .min(8, 'password debe tener al menos 8 caracteres')
    .max(72, 'password no puede superar 72 caracteres'),
});

export const loginSchema = z.strictObject({
  email: z.email({ error: 'correo electrónico inválido' }),
  // Mismo límite que el registro: bcrypt solo considera 72 bytes
  password: z
    .string()
    .min(1, 'password es obligatoria')
    .max(72, 'password no puede superar 72 caracteres'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
