import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Use a Proxy to lazily instantiate PrismaClient.
// This completely bypasses Next.js Turbopack's static evaluation which attempts
// to eagerly instantiate Prisma without proper environment context during builds.
export const prisma = new Proxy({} as PrismaClient, {
    get(target, prop, receiver) {
        if (!globalForPrisma.prisma) {
            globalForPrisma.prisma = new PrismaClient();
            if (process.env.NODE_ENV !== "production") {
                globalForPrisma.prisma = globalForPrisma.prisma;
            }
        }
        return Reflect.get(globalForPrisma.prisma, prop, receiver);
    }
});

export default prisma;
