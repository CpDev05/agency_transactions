import type { Response } from 'express';

export function sendData<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data });
}

export function sendCreated<T>(res: Response, data: T): void {
  sendData(res, data, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}

export function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}
