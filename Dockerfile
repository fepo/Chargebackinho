# Stage 1: Dependências e Build
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências nativas necessárias para o better-sqlite3 e temporárias do build
RUN apk add --no-cache python3 make g++ 

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Gera o cliente Prisma com os binários do Alpine
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Stage 2: Produção (Imagem menor apenas com output standalone)
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Cria diretórios pro SQLite e banco
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.prisma/client ./node_modules/.prisma/client
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# O banco dev.db default será no diretório /app/data que pode ser mapeado como volume
ENV DATABASE_URL=""

CMD ["node", "server.js"]
