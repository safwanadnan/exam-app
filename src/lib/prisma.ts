import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? (function () {
    const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
    
    // In Prisma 7, the adapter constructor takes an options object with the URL
    const adapter = new PrismaBetterSqlite3({
        url: databaseUrl
    });
    
    return new PrismaClient({ adapter });
})();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
