// Prisma singleton — updated after schema migration (sectionGroup model added)
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
    const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    return new PrismaClient({ adapter });
}

// Avoid stale model metadata in dev after schema/client changes.
// Production still uses a singleton to reduce connection churn.
export const prisma =
    process.env.NODE_ENV === "production"
        ? (globalForPrisma.prisma ?? createPrismaClient())
        : createPrismaClient();

if (process.env.NODE_ENV === "production") {
    globalForPrisma.prisma = prisma;
}

export default prisma;
