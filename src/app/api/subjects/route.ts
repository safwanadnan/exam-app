import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");

    try {
        const subjects = await prisma.subject.findMany({
            where: departmentId ? { departmentId } : undefined,
            include: { _count: { select: { courses: true } } },
            orderBy: { code: 'asc' }
        });
        return NextResponse.json({ subjects });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const subject = await prisma.subject.create({
            data: {
                code: body.code,
                name: body.name,
                departmentId: body.departmentId,
            }
        });
        return NextResponse.json({ subject });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create subject" }, { status: 500 });
    }
}
