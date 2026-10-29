import type { Server } from 'node:http';
import { app } from './app';
import { closeDatabase, connectDatabase } from './config/database';
import { env } from './config/env';

const SHUTDOWN_TIMEOUT_MS = 10_000;

function shutdown(server: Server, signal: NodeJS.Signals): void {
  console.log(`Señal ${signal} recibida; cerrando servidor...`);

  // Red de seguridad por si alguna conexión keep-alive impide cerrar a tiempo
  const forceExit = setTimeout(() => {
    console.error('Cierre forzado: quedaron conexiones abiertas');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close((err) => {
    void (async () => {
      if (err) {
        console.error(`Error al cerrar el servidor HTTP: ${err.message}`);
        process.exitCode = 1;
      }

      try {
        await closeDatabase();
      } catch (dbErr) {
        const message = dbErr instanceof Error ? dbErr.message : 'error desconocido';
        console.error(`Error al cerrar MongoDB: ${message}`);
        process.exitCode = 1;
      }

      clearTimeout(forceExit);
      process.exit();
    })();
  });

  // Acelera el cierre de conexiones ociosas (keep-alive)
  server.closeIdleConnections();
}

async function main(): Promise<void> {
  try {
    await connectDatabase();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error desconocido';
    console.error(`No se pudo conectar a MongoDB: ${message}`);
    process.exit(1);
  }

  const server: Server = app.listen(env.PORT, env.HOST, () => {
    console.log(`API escuchando en http://${env.HOST}:${env.PORT} (${env.NODE_ENV})`);
  });

  server.on('error', (err) => {
    console.error(`No se pudo iniciar el servidor en el puerto ${env.PORT}: ${err.message}`);
    process.exit(1);
  });

  let shuttingDown = false;
  const handleSignal = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    shutdown(server, signal);
  };

  process.once('SIGTERM', () => handleSignal('SIGTERM'));
  process.once('SIGINT', () => handleSignal('SIGINT'));
}

void main();
