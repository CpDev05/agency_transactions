import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { HttpError } from '../src/utils/httpError';
import { requireUserId, resolveOwnerId } from '../src/middlewares/owner.middleware';

const AUTHENTICATED_ID = 'a11ce0000000000000000001';

function fakeRequest(user?: { id: string }): Request {
  return { user } as Request;
}

describe('resolveOwnerId', () => {
  it('devuelve el id del usuario autenticado por JWT', () => {
    expect(resolveOwnerId(fakeRequest({ id: AUTHENTICATED_ID }))).toBe(AUTHENTICATED_ID);
  });

  it('devuelve null cuando no hay usuario autenticado', () => {
    expect(resolveOwnerId(fakeRequest())).toBeNull();
  });

  it('ignora por completo identificadores enviados por el cliente', () => {
    const req = {
      body: { userId: AUTHENTICATED_ID },
      query: { userId: AUTHENTICATED_ID },
      params: { userId: AUTHENTICATED_ID },
    } as unknown as Request;

    expect(resolveOwnerId(req)).toBeNull();
  });
});

describe('requireUserId', () => {
  it('devuelve el id del propietario autenticado', () => {
    expect(requireUserId(fakeRequest({ id: AUTHENTICATED_ID }))).toBe(AUTHENTICATED_ID);
  });

  it('lanza un HttpError 401 si no hay usuario autenticado', () => {
    let caught: unknown;
    try {
      requireUserId(fakeRequest());
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(HttpError);
    expect((caught as HttpError).status).toBe(401);
  });
});
