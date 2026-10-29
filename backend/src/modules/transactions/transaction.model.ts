import { Schema, model, models, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

const transactionSchema = new Schema(
  {
    description: {
      type: String,
      required: [true, 'description es obligatoria'],
      trim: true,
      maxlength: [200, 'description no puede superar 200 caracteres'],
    },
    amount: {
      type: Number,
      required: [true, 'amount es obligatorio'],
      validate: {
        validator: (value: number) => value > 0,
        message: 'amount debe ser mayor que 0',
      },
    },
    type: {
      type: String,
      required: [true, 'type es obligatorio'],
      enum: {
        values: ['income', 'expense'],
        message: 'type debe ser "income" o "expense"',
      },
    },
    category: {
      type: String,
      required: [true, 'category es obligatorio'],
      trim: true,
      maxlength: [100, 'category no puede superar 100 caracteres'],
    },
    date: {
      type: Date,
      required: [true, 'date es obligatorio'],
    },
    // Propietario. El modelo User se registra en la Etapa 3 (autenticación);
    // el ref solo se resuelve al poblar, por lo que es seguro declararlo aquí.
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId es obligatorio'],
      index: true,
    },
  },
  { timestamps: true },
);

transactionSchema.index({ userId: 1, date: -1 });

export type Transaction = InferSchemaType<typeof transactionSchema>;

export type TransactionDocument = HydratedDocument<Transaction>;

export const TransactionModel: Model<Transaction> =
  (models.Transaction as Model<Transaction> | undefined) ??
  model<Transaction>('Transaction', transactionSchema);
