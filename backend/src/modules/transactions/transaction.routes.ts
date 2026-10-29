import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { transactionController } from './transaction.controller';

export const transactionRouter = Router();

// Todas las operaciones requieren un usuario autenticado (JWT)
transactionRouter.use(requireAuth);

// Rutas estáticas y con parámetro: los literales se declaran primero
transactionRouter.post('/', transactionController.create);
transactionRouter.get('/', transactionController.list);
transactionRouter.get('/:id', transactionController.getById);
transactionRouter.patch('/:id', transactionController.update);
transactionRouter.delete('/:id', transactionController.remove);
