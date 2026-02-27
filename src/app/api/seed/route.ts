import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
    try {
        const password = await bcrypt.hash("admin123", 10);
        const user = await prisma.user.upsert({
            where: { email: "admin@example.com" },
            update: {
                hashedPassword: password,
                role: "ADMIN"
            },
            create: {
                email: "admin@example.com",
                name: "University Admin",
                role: "ADMIN",
                hashedPassword: password,
            }
        });
        return NextResponse.json({ message: "Admin user seeded", email: user.email });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
