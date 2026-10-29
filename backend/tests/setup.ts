// Se ejecuta antes de cargar los módulos de la aplicación en cada archivo de
// prueba, de modo que src/config/env.ts valide este entorno aislado.
// Nunca se usan datos financieros reales.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/agency_transactions_test_no_usado';
process.env.JWT_SECRET = 'jwt-de-pruebas-0123456789abcdef-0123456789abcdef';
process.env.JWT_EXPIRES_IN = '1h';
// Límite holgado para el resto de archivos; rate-limit.test.ts lo consume entero
process.env.LOGIN_RATE_LIMIT_MAX = '10';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';
delete process.env.CORS_ORIGIN;
