# syntax=docker/dockerfile:1

# Dependencias completas (incluye devDependencies para el build)
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Compilación de TypeScript
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Solo dependencias de producción para la imagen final
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    HOST=0.0.0.0
WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 4000

# Comprueba la salud con el endpoint existente usando fetch nativo de Node
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
