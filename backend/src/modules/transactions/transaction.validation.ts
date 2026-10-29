import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'identificador inválido: debe ser un ObjectId de 24 caracteres');

export const idParamsSchema = z.object({ id: objectIdSchema });

const transactionFields = {
  description: z.string().trim().min(1, 'description no puede estar vacío').max(200),
  amount: z.number().positive('amount debe ser mayor que 0'),
  type: z.enum(['income', 'expense']),
  category: z.string().trim().min(1, 'category no puede estar vacío').max(100),
  date: z.coerce.date({ error: 'date debe ser una fecha válida' }),
};

// strictObject: rechaza claves desconocidas, de modo que un `userId`
// enviado por el cliente produce 400 y nunca se usa como prueba de propiedad.
export const createTransactionSchema = z.strictObject(transactionFields);

export const updateTransactionSchema = z
  .strictObject({
    description: transactionFields.description.optional(),
    amount: transactionFields.amount.optional(),
    type: transactionFields.type.optional(),
    category: transactionFields.category.optional(),
    date: transactionFields.date.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    error: 'debe incluir al menos un campo a actualizar',
  });

export const listTransactionsQuerySchema = z
  .object({
    type: transactionFields.type.optional(),
    category: z.string().trim().min(1).optional(),
    startDate: transactionFields.date.optional(),
    endDate: transactionFields.date.optional(),
  })
  .refine(
    (value) =>
      value.startDate === undefined ||
      value.endDate === undefined ||
      value.startDate.getTime() <= value.endDate.getTime(),
    { error: 'startDate debe ser menor o igual a endDate' },
  );

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionFilters = z.infer<typeof listTransactionsQuerySchema>;
