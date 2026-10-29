import type { QueryFilter, UpdateQuery } from 'mongoose';
import { notFoundError } from '../../utils/httpError';
import {
  TransactionModel,
  type Transaction,
  type TransactionDocument,
} from './transaction.model';
import type { TransactionFilters } from './transaction.validation';

export interface CreateTransactionData {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: Date;
}

export type UpdateTransactionData = {
  [K in keyof CreateTransactionData]?: CreateTransactionData[K] | undefined;
};

export async function createTransaction(
  userId: string,
  data: CreateTransactionData,
): Promise<TransactionDocument> {
  return TransactionModel.create({ ...data, userId });
}

export async function listTransactions(
  userId: string,
  filters: TransactionFilters = {},
): Promise<TransactionDocument[]> {
  const query: QueryFilter<Transaction> = { userId };

  if (filters.type !== undefined) {
    query.type = filters.type;
  }
  if (filters.category !== undefined) {
    query.category = filters.category;
  }
  if (filters.startDate !== undefined || filters.endDate !== undefined) {
    const range: { $gte?: Date; $lt?: Date } = {};
    if (filters.startDate !== undefined) {
      const s = new Date(filters.startDate);
      s.setUTCHours(0, 0, 0, 0);
      range.$gte = s;
    }
    if (filters.endDate !== undefined) {
      const e = new Date(filters.endDate);
      e.setUTCHours(0, 0, 0, 0);
      e.setUTCDate(e.getUTCDate() + 1);
      range.$lt = e;
    }
    query.date = range;
  }

  return TransactionModel.find(query).sort({ date: -1, _id: -1 }).exec();
}

// La propiedad se resuelve dentro de la propia consulta: si el documento no
// pertenece al usuario, se comporta igual que uno inexistente (404).
export async function getTransactionById(
  userId: string,
  id: string,
): Promise<TransactionDocument> {
  const transaction = await TransactionModel.findOne({ _id: id, userId }).exec();
  if (!transaction) {
    throw notFoundError('Transacción no encontrada');
  }
  return transaction;
}

export async function updateTransaction(
  userId: string,
  id: string,
  data: UpdateTransactionData,
): Promise<TransactionDocument> {
  const update: UpdateQuery<Transaction> = { $set: { ...data } };
  const transaction = await TransactionModel.findOneAndUpdate(
    { _id: id, userId },
    update,
    { returnDocument: 'after', runValidators: true },
  ).exec();
  if (!transaction) {
    throw notFoundError('Transacción no encontrada');
  }
  return transaction;
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  const deleted = await TransactionModel.findOneAndDelete({ _id: id, userId }).exec();
  if (!deleted) {
    throw notFoundError('Transacción no encontrada');
  }
}
