import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    try {
        const departments = await prisma.department.findMany({
            where: sessionId ? { sessionId } : undefined,
            include: { _count: { select: { subjects: true } } },
            orderBy: { code: 'asc' }
        });
        return NextResponse.json({ departments });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const department = await prisma.department.create({
            data: {
                code: body.code,
                name: body.name,
                sessionId: body.sessionId,
            }
        });
        return NextResponse.json({ department });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create department" }, { status: 500 });
    }
}
