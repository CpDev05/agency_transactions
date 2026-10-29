# agency_transactions

API REST para la gestión de transacciones financieras personales: registro de usuarios, ingresos/gastos, filtros y resumen financiero.

- **Backend**: Node.js, Express 5, TypeScript (estricto), MongoDB con Mongoose, validación con Zod, JWT.
- **Frontend**: React + Vite (en desarrollo; esta documentación cubre el backend).

> **Estado**: Etapas 1–3 completadas (servidor, CRUD de transacciones, autenticación JWT), Etapa 5 completada (auditoría de pruebas, seguridad y calidad), refuerzo de seguridad aplicado (rate limiting, Helmet y validación de usuario vigente en el JWT) y Etapa 6 completada y verificada (Dockerfile y Docker Compose).
> La Etapa 4 (resumen financiero) queda aplazada. El stack Docker fue construido y probado con el volumen de datos existente; el contenedor antiguo `agency-transactions` quedó detenido (no eliminado) como respaldo.

## Requisitos

- Node.js 20+ (probado con Node 24)
- MongoDB local, o MongoDB accesible por URI
- Docker Desktop con Compose v2 (opcional, para el stack contenerizado)

## Instalación

```bash
cd backend
npm install
cp .env.example .env      # y edita los valores
```

## Variables de entorno (`backend/.env`)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `PORT` | no (4000) | Puerto del servidor. En Compose el contenedor siempre usa 4000; el puerto del host se ajusta con `BACKEND_PORT` |
| `HOST` | no (`0.0.0.0`) | Interfaz de escucha. `0.0.0.0` es necesario dentro de Docker |
| `NODE_ENV` | no (`development`) | `development` \| `test` \| `production` |
| `MONGODB_URI` | sí | URI de MongoDB. Local: `mongodb://localhost:27017/agency_transactions` |
| `JWT_SECRET` | sí | Secreto para firmar JWT (mínimo 32 caracteres). Genera uno: `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | no (`1h`) | Duración del access token con unidad obligatoria (`15m`, `1h`, `7d`) |
| `CORS_ORIGIN` | no | Origen permitido del frontend. En producción, si no se define, no se habilitan cabeceras CORS (solo mismo origen) |
| `LOGIN_RATE_LIMIT_MAX` | no (`10`) | Máximo de intentos de login por IP dentro de la ventana |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | no (`900000`) | Ventana del límite de login en milisegundos (15 minutos por defecto) |

Nunca versiones un archivo `.env` real: `.gitignore` lo excluye.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Desarrollo con recarga automática (tsx watch) |
| `npm run build` | Compila a `dist/` |
| `npm start` | Ejecuta la compilación (`node dist/server.js`) |
| `npm run typecheck` | Comprobación de tipos: código fuente y pruebas |
| `npm test` | Suite de pruebas (Vitest + Supertest + MongoDB en memoria) |
| `npm run test:coverage` | Suite con informe de cobertura (V8) |
| `npm run test:watch` | Pruebas en modo watch |

## Endpoints

Todas las respuestas usan un envolvente común:

- Éxito: `{ "data": ... }` (204 sin cuerpo para `DELETE`)
- Error: `{ "error": { "code": "...", "message": "..." } }`

Los endpoints marcados con 🔒 exigen `Authorization: Bearer <accessToken>` (emitido por login/register). La identidad proviene **solo** del JWT: cualquier `userId` enviado por el cliente se ignora (en creación responde 400).

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| GET | `/api/health` | Salud del servicio | 200 | — |
| POST | `/api/auth/register` | Registrar usuario (name, email, password) | 201 | 400, 409 |
| POST | `/api/auth/login` | Autenticarse y obtener accessToken | 200 | 400, 401, 429 |
| GET | `/api/auth/me` 🔒 | Perfil del usuario autenticado | 200 | 401, 404 |
| POST | `/api/transactions` 🔒 | Crear transacción | 201 | 400, 401 |
| GET | `/api/transactions` 🔒 | Listar (filtros: `type`, `category`, `startDate`, `endDate`) | 200 | 400, 401 |
| GET | `/api/transactions/:id` 🔒 | Detalle | 200 | 400, 401, 404 |
| PATCH | `/api/transactions/:id` 🔒 | Actualizar campos | 200 | 400, 401, 404 |
| DELETE | `/api/transactions/:id` 🔒 | Eliminar | 204 | 400, 401, 404 |

Cada usuario solo ve y modifica sus propias transacciones; acceder a la de otra persona responde 404 (sin revelar que existe).

### Ejemplos

```bash
# Registrar usuario y obtener token
curl -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana Pérez","email":"ana@ejemplo.com","password":"contrasena-segura-1"}'

# Iniciar sesión
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@ejemplo.com","password":"contrasena-segura-1"}'

TOKEN='...' # accessToken devuelto por register o login

# Crear transacción (con token)
curl -X POST http://localhost:4000/api/transactions \
  -H 'Authorization: Bearer '"$TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"description":"Nómina","amount":1500000,"type":"income","category":"Trabajo","date":"2026-10-15"}'

# Listar con filtros
curl 'http://localhost:4000/api/transactions?type=expense&startDate=2026-10-01&endDate=2026-10-31' \
  -H 'Authorization: Bearer '"$TOKEN"

# Detalle / actualizar / eliminar
curl http://localhost:4000/api/transactions/<id> -H 'Authorization: Bearer '"$TOKEN"
curl -X PATCH http://localhost:4000/api/transactions/<id> \
  -H 'Authorization: Bearer '"$TOKEN" \
  -H 'Content-Type: application/json' -d '{"amount":200000}'
curl -X DELETE http://localhost:4000/api/transactions/<id> -H 'Authorization: Bearer '"$TOKEN"
```

Registro: `name` (1–100 chars), `email` (único, normalizado a minúsculas), `password` (8–72 chars; se almacena con bcrypt y nunca se devuelve). Login y registro devuelven `{ "data": { "user": {...}, "accessToken": "..." } }`. Un correo duplicado responde 409; credenciales inválidas, 401.

El login está limitado por IP (10 intentos cada 15 minutos por defecto). Al superar el límite responde `429` con `{ "error": { "code": "TOO_MANY_REQUESTS", "message": "..." } }`.

Cuerpo de creación de transacción: `description` (string, obligatorio), `amount` (número > 0, obligatorio), `type` (`income` \| `expense`), `category` (string, obligatorio), `date` (fecha ISO, obligatoria). Se rechazan campos desconocidos (incluido un `userId` enviado por el cliente).

## Pruebas

```bash
npm test              # suite completa
npm run test:coverage # suite + cobertura
```

- Vitest + Supertest contra **mongodb-memory-server**: cada archivo de prueba levanta su propia instancia efímera. Nunca se conecta a la base de datos de desarrollo ni se tocan contenedores/volúmenes.
- Cubren: registro/login (éxito, duplicados, validaciones), tokens ausentes/inválidos/expirados/firmados con otro secreto o algoritmo, usuarios eliminados (el token deja de autorizar) y `sub` no válido, contraseñas y hashes ausentes en respuestas, CRUD completo con tokens, filtros (tipo, categoría, fechas, parámetros ignorados/inyectados), identificadores inválidos/inexistentes, aislamiento entre dos usuarios reales (lectura, actualización, borrado, propietario inmutable, filtros), límite de intentos de login (429), cabeceras de seguridad de Helmet, manejador central de errores (Zod, CastError, ValidationError, 500 en producción), validación de variables de entorno, CORS y el endpoint de salud.
- La concurrencia está limitada (`maxWorkers: 2`) porque cada archivo arranca un MongoDB efímero; en equipos con WSL sobre `/mnt/c` el arranque es lento.
- No se usan datos financieros reales.

## Seguridad

- Secretos (`JWT_SECRET`) solo por variables de entorno; `.env` está en `.gitignore` y `.env.example` trae un secreto inválido a propósito para forzar su configuración.
- Contraseñas con bcrypt (10 rondas); nunca se devuelven ni se registran. Login compara siempre contra un hash (incluido el caso de correo inexistente) para no filtrar la existencia de cuentas por tiempo de respuesta.
- JWT firmado con HS256 y expiración obligatoria; el middleware verifica firma, algoritmo y `sub`, con esquema `Bearer` insensible a mayúsculas. En cada petición protegida comprueba además que el usuario siga existiendo: un token vigente de una cuenta eliminada responde 401.
- La identidad sale solo del token verificado; un `userId` del cliente se rechaza (creación) o se ignora (query). Recursos ajenos responden 404 (no revelan su existencia).
- Validación con Zod de cuerpos, params y query; límite de cuerpo de 100 KB.
- Rate limiting en `POST /api/auth/login` por IP (10 intentos / 15 min por defecto, configurable) con respuesta 429 y cabeceras `RateLimit` estándar; el resto de endpoints no se ven afectados.
- **Limitación del rate limit**: el almacén es en memoria. Los contadores se reinician al reiniciar el proceso y no se comparten entre réplicas (en esta etapa no se añade Redis ni otro servicio).
- Helmet activo con las protecciones por defecto (`nosniff`, frameguard, HSTS, `Referrer-Policy`, CORP...) y CSP desactivada porque la API solo devuelve JSON; `x-powered-by` deshabilitado.
- Errores centralizados con envolvente consistente; en producción los 5xx ocultan mensajes internos y stacks.
- CORS restringido al origen configurado (en producción, sin `CORS_ORIGIN` no se habilita CORS).
- `npm audit`: sin vulnerabilidades conocidas al momento de la auditoría.

## Docker Compose

Archivos:

- `backend/Dockerfile`: build multi-stage (dependencias completas → compilación → solo dependencias de producción → runtime `node:24-alpine`, usuario `node`, `HEALTHCHECK` contra `/api/health`).
- `backend/.dockerignore`: excluye `node_modules`, `dist`, `tests`, `.env` y artefactos locales.
- `docker-compose.yml`: servicios `backend` y `mongo` (imagen `mongo:8`) en la red `agency_net`, healthcheck de MongoDB y `depends_on: service_healthy`. Reutiliza como **volumen externo** el volumen existente `agency_transactions-mongo-data`; Compose no lo crea ni lo elimina.

Arquitectura:

- `mongo` publica el puerto **solo en loopback** (`127.0.0.1:27017`), para que el backend ejecutado directamente en Windows siga usando `mongodb://127.0.0.1:27017/agency_transactions`. Dentro de Compose también es accesible como `mongo:27017`.
- `backend` se conecta con `MONGODB_URI=mongodb://mongo:27017/agency_transactions` (nombre del servicio, nunca `localhost`).
- `backend` publica `${BACKEND_PORT:-4000}` en el host y escucha en `0.0.0.0:4000` dentro del contenedor.
- `NODE_ENV=production`, `PORT=4000` y `HOST=0.0.0.0` se fijan en Compose. El resto (por ejemplo `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`) se lee de `backend/.env`, que está ignorado por Git y nunca se copia a la imagen.

Preparación y comandos:

```bash
cp backend/.env.example backend/.env   # completar JWT_SECRET (mínimo 32 caracteres)
docker compose config --quiet          # validar sintaxis
docker compose build backend           # construir la imagen
BACKEND_PORT=4001 docker compose up -d # iniciar MongoDB + backend (4001 si el local usa 4000)
docker compose ps                      # estado y salud
docker compose logs -f backend         # logs del backend
curl http://localhost:4001/api/health  # comprobar salud
docker compose stop                    # detener sin borrar contenedores ni volumen
docker compose down                    # eliminar contenedores; CONSERVA el volumen externo
```

Sin `BACKEND_PORT`, el backend de Compose publica el puerto **4000** (el mismo que usa el backend local por defecto); elige uno de los dos si quieres ejecutarlos a la vez. En esta verificación el stack quedó en **4001** para convivir con el backend local.

No ejecutes `docker compose down -v`, `docker volume rm` ni `docker rm -v`: borran contenedores/volúmenes. Aunque el volumen está declarado `external` (y `down` no lo elimina), evita esos comandos.

### MongoDB local (desarrollo sin Compose)

`docker-compose.yml` publica MongoDB únicamente en `127.0.0.1:27017`, de modo que `cd backend && npm run dev` sigue funcionando con el `MONGODB_URI=mongodb://127.0.0.1:27017/agency_transactions` existente. Ambos flujos usan **la misma base y los mismos datos**: el backend local por `127.0.0.1:27017` y el de Compose por el hostname `mongo`.

Si necesitas cambiar el puerto de Mongo en el host (por ejemplo, para otra instancia), define `MONGO_PORT`: `MONGO_PORT=27018 docker compose up -d` y ajusta `MONGODB_URI` en `backend/.env`.

### Estado del contenedor y del volumen existentes

Inspección realizada (2026-10-23) con el daemon accesible:

- Contenedor `agency-transactions` (imagen `mongo:8`, mismo ID que la imagen local) con el volumen nombrado `agency_transactions-mongo-data` montado en `/data/db` (203 MB de datos) y `27017` publicado.
- Base `agency_transactions` con datos reales: `users=1`, `transactions=3`.
- Un volumen anónimo aparte para `/data/configdb` (no afecta a los datos de la aplicación en un `mongod` standalone).

Transición realizada, sin copiar ni borrar datos:

1. Se construyó la imagen del backend y se validó Compose con el volumen externo.
2. `docker stop agency-transactions` (el contenedor **sigue existiendo**, en estado `Exited (0)`; no se eliminó).
3. `BACKEND_PORT=4001 docker compose up -d`: Compose monta `agency_transactions-mongo-data` y publica Mongo en loopback 27017.
4. Se comprobó que los datos seguían intactos (`users=1`, `transactions=3`) y que sobreviven a `docker compose restart mongo` y a un ciclo `docker compose down` + `up`.

Rollback (sin destruir datos): detén primero Compose para liberar el volumen y vuelve a arrancar el contenedor antiguo:

```bash
docker compose stop backend mongo
docker start agency-transactions
```

No arranques `agency-transactions` mientras el `mongo` de Compose esté en marcha: dos procesos `mongod` sobre el mismo volumen pueden corromper los datos. No elimines el contenedor antiguo hasta que decidas no volver atrás.

### Copia lógica (alternativa, no ejecutada)

Si en el futuro prefieres un volumen nuevo en lugar de reutilizar el existente:

```bash
docker exec agency-transactions mongodump --db=agency_transactions --archive=/tmp/agency.gz --gzip
docker cp agency-transactions:/tmp/agency.gz ./agency.gz
docker compose up -d mongo
docker compose exec -T mongo mongorestore --gzip --archive --nsInclude='agency_transactions.*' < agency.gz
```

Comprueba antes que `mongodump` existe en la imagen y compara los conteos. No elimines el contenedor antiguo hasta validar la copia.

### Autenticación de MongoDB (opcional, no habilitada por defecto)

El stack no define credenciales por defecto: MongoDB escucha solo en loopback del host y en la red interna de Compose, sin autenticación. Si habilitas autenticación, añade en un override local (nunca versionado) `MONGO_INITDB_ROOT_USERNAME`/`MONGO_INITDB_ROOT_PASSWORD` (se aplican solo al inicializar un volumen vacío) y usa una URI con credenciales y `?authSource=admin` en `MONGODB_URI`. Para el volumen ya existente hay que crear el usuario manualmente con `mongosh`; documenta y rota esos secretos fuera del repositorio.

### Verificación realizada

| Comprobación | Resultado |
|---|---|
| `docker compose config --quiet` | OK; servicios `mongo`/`backend`, volumen externo `agency_transactions-mongo-data`, Mongo en `127.0.0.1:27017` |
| `docker compose build backend` | OK; imagen `agency-transactions-backend:local` |
| Imagen final | Usuario `node` (UID 1000), sin `.env` ni `tests`; `HEALTHCHECK` activo |
| `docker compose up -d` (BACKEND_PORT=4001) | MongoDB y backend `healthy`; backend conecta por `mongo:27017` |
| Datos tras el cambio | 3 transacciones y 1 usuario originales intactos; conteos verificados por `_id` |
| Persistencia | `restart mongo` y ciclo `down`+`up`: datos intactos (`users=2`, `transactions=4` incluyendo registros de prueba) |
| `GET /api/health` | 200 en `http://127.0.0.1:4001` |
| API real | Registro, login, crear, obtener, actualizar y listar: OK (respuesta `{data: ...}` con `_id`) |
| Backend local Windows | Arrancado temporalmente en 4010 contra `127.0.0.1:27017` (Mongo de Compose): health 200; proceso detenido después |
| `npm run typecheck` | OK |
| `npm test` | **103/103** en 9 archivos (88,62 s) |
| `npm run build` | OK |
| `npm audit` | 0 vulnerabilidades |

Registros de prueba añadidos durante la verificación (no se borró nada): usuario `compose-check-1792731531541@test.local` y transacción `6adae98ca3aa7e76412b76c7` (categoría `verificacion`). El estado final del stack es backend en **4001** y MongoDB en **127.0.0.1:27017**, ambos `healthy`.

## Solución de problemas

- **Error de binario de plataforma** (`@esbuild/...` o `@typescript/typescript-...`)**: si alternas entre Windows y WSL en la misma carpeta, ejecuta `npm install` en el sistema donde vayas a trabajar (npm instala solo el binario de tu plataforma). Si persiste: `npm rebuild esbuild`.

## Pendiente (etapas siguientes)

- Etapa 4 (aplazada): resumen financiero `GET /api/transactions/summary`.
- Etapa 6: completada y verificada (Dockerfile, Compose, persistencia y API con MongoDB real).
