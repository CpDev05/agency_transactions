import type { Request, Response } from 'express';
import { requireUserId } from '../../middlewares/owner.middleware';
import { sendData, sendCreated, sendNoContent } from '../../utils/responses';
import {
  createTransactionSchema,
  idParamsSchema,
  listTransactionsQuerySchema,
  updateTransactionSchema,
} from './transaction.validation';
import {
  createTransaction,
  deleteTransaction,
  getTransactionById,
  listTransactions,
  updateTransaction,
} from './transaction.service';

export const transactionController = {
  create: async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const input = createTransactionSchema.parse(req.body);
    const created = await createTransaction(userId, input);
    sendCreated(res, created);
  },

  list: async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const filters = listTransactionsQuerySchema.parse(req.query);
    const transactions = await listTransactions(userId, filters);
    sendData(res, transactions);
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { id } = idParamsSchema.parse(req.params);
    const transaction = await getTransactionById(userId, id);
    sendData(res, transaction);
  },

  update: async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { id } = idParamsSchema.parse(req.params);
    const patch = updateTransactionSchema.parse(req.body);
    const updated = await updateTransaction(userId, id, patch);
    sendData(res, updated);
  },

  remove: async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { id } = idParamsSchema.parse(req.params);
    await deleteTransaction(userId, id);
    sendNoContent(res);
  },
};
