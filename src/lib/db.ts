import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import path from "path";

function createPrismaClient() {
  const dbPath = (process.env.DATABASE_URL ?? "file:./dev.db").replace("file:", "");
  const sqlite = new Database(path.resolve(process.cwd(), dbPath));
  const adapter = new PrismaBetterSqlite3({ url: dbPath } as any);
  void sqlite; // adapter manages the connection
  return new PrismaClient({ adapter } as any);
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
