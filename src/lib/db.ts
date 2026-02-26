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
  let dbPath = resolvedUrl.replace("file:", "");
  let absolutePath = path.resolve(process.cwd(), dbPath);

  // No build do Next, o DB dev.db pode não existir no root
  try {
    const fs = require("fs");
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) { }

  const sqlite = new Database(absolutePath);
  const adapter = new PrismaBetterSqlite3({ url: absolutePath } as any);
  void sqlite; // adapter manages the connection
  return new PrismaClient({ adapter } as any);
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
  // Em produção DE FATO (Vercel + Neon Postgres)
  prisma = createPrismaClient();
} else {
  // Desenvolvimento ou Produção sem DATABASE_URL (fallback para SQLite)
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  prisma = globalForPrisma.prisma;
}

export { prisma };
