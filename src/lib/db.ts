import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import path from "path";

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (process.env.NODE_ENV === "production" && !databaseUrl) {
    throw new Error("DATABASE_URL não configurada em produção");
  }

  const resolvedUrl = databaseUrl ?? "file:./dev.db";
  const dbPath = resolvedUrl.replace("file:", "");
  const sqlite = new Database(path.resolve(process.cwd(), dbPath));
  const adapter = new PrismaBetterSqlite3({ url: dbPath } as any);
  void sqlite; // adapter manages the connection
  return new PrismaClient({ adapter } as any);
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Lazy singleton — só cria a conexão no primeiro acesso real, não no import */
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as any)[prop];
  },
});

export default prisma;
