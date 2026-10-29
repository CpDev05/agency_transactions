import { describe, expect, it } from 'vitest';
import { resolveCorsOptions } from '../src/app';
import { parseEnv } from '../src/config/env';

const validEnv = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/agency_transactions_test',
  JWT_SECRET: 'a'.repeat(64),
};

describe('validación de variables de entorno', () => {
  it('aplica valores por defecto seguros', () => {
    const env = parseEnv(validEnv);

    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(4000);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.JWT_EXPIRES_IN).toBe('1h');
    expect(env.CORS_ORIGIN).toBeUndefined();
    expect(env.LOGIN_RATE_LIMIT_MAX).toBe(10);
    expect(env.LOGIN_RATE_LIMIT_WINDOW_MS).toBe(900_000);
  });

  it('acepta una configuración completa y válida', () => {
    const env = parseEnv({
      ...validEnv,
      PORT: '4321',
      HOST: '127.0.0.1',
      JWT_EXPIRES_IN: '7d',
      CORS_ORIGIN: 'https://app.example.com',
    });

    expect(env.PORT).toBe(4321);
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.JWT_EXPIRES_IN).toBe('7d');
    expect(env.CORS_ORIGIN).toBe('https://app.example.com');
  });

  it('rechaza JWT_SECRET de menos de 32 caracteres', () => {
    expect(() => parseEnv({ ...validEnv, JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });

  it('rechaza JWT_EXPIRES_IN sin unidad', () => {
    expect(() => parseEnv({ ...validEnv, JWT_EXPIRES_IN: '3600' })).toThrow(/JWT_EXPIRES_IN/);
  });

  it('rechaza MONGODB_URI con un esquema no soportado', () => {
    expect(() => parseEnv({ ...validEnv, MONGODB_URI: 'postgres://localhost/db' })).toThrow(
      /MONGODB_URI/,
    );
  });

  it('rechaza PORT fuera de rango', () => {
    expect(() => parseEnv({ ...validEnv, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rechaza NODE_ENV desconocido', () => {
    expect(() => parseEnv({ ...validEnv, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('rechaza CORS_ORIGIN que no es una URL', () => {
    expect(() => parseEnv({ ...validEnv, CORS_ORIGIN: 'no-es-url' })).toThrow(/CORS_ORIGIN/);
  });

  it('rechaza límites de login inválidos', () => {
    expect(() => parseEnv({ ...validEnv, LOGIN_RATE_LIMIT_MAX: '0' })).toThrow(
      /LOGIN_RATE_LIMIT_MAX/,
    );
    expect(() => parseEnv({ ...validEnv, LOGIN_RATE_LIMIT_WINDOW_MS: '999' })).toThrow(
      /LOGIN_RATE_LIMIT_WINDOW_MS/,
    );
  });
});

describe('resolución de CORS', () => {
  it('usa el origen explícito cuando está configurado', () => {
    expect(resolveCorsOptions('http://localhost:5173', 'production')).toEqual({
      origin: 'http://localhost:5173',
    });
  });

  it('permite cualquier origen en desarrollo si no hay configuración', () => {
    expect(resolveCorsOptions(undefined, 'development')).toEqual({});
    expect(resolveCorsOptions(undefined, 'test')).toEqual({});
  });

  it('no habilita CORS en producción si no hay origen configurado', () => {
    expect(resolveCorsOptions(undefined, 'production')).toBeNull();
  });
});
