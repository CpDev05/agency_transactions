import type { Request, Response } from 'express';
import { requireUserId } from '../../middlewares/owner.middleware';
import { sendData, sendCreated } from '../../utils/responses';
import {
  getPublicUser,
  login as loginService,
  register as registerService,
} from './auth.service';
import { loginSchema, registerSchema } from './auth.validation';

export const authController = {
  register: async (req: Request, res: Response): Promise<void> => {
    const input = registerSchema.parse(req.body); //valida el body 
    const result = await registerService(input); // Lógica del servicio de registro
    sendCreated(res, result); // respuesta 201
  },

  login: async (req: Request, res: Response): Promise<void> => {
    const input = loginSchema.parse(req.body); //valida el body 
    const result = await loginService(input); //Lógica del servicio de login
    sendData(res, result); // respuesta 200
  },

  me: async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req); // obtiene el id del usuario autenticado
    const user = await getPublicUser(userId); // Consulta en la base de datos
    sendData(res, user); // respuesta 200 devolviendo la info del usuario 
  },
};
