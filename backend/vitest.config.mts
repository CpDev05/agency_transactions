import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    // La primera ejecución descarga el binario de MongoDB en memoria
    hookTimeout: 180000,
    // Cada archivo levanta su propio MongoDB efímero: limitar la concurrencia
    // evita agotar recursos en equipos lentos (p. ej. WSL sobre /mnt/c).
    maxWorkers: 2,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Punto de entrada del proceso (arranque real) no se ejercita en pruebas
      exclude: ['src/server.ts'],
      reporter: ['text', 'text-summary'],
    },
  },
});
