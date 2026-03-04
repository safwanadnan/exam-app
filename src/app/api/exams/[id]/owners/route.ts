import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
    try {
        const { id } = await params;
        const owners = await prisma.examOwner.findMany({
            where: { examId: id },
            include: { section: { include: { course: { include: { subject: true } } } } }
        });
        return NextResponse.json({ owners });
    } catch {
        return NextResponse.json({ error: "Failed to fetch exam owners" }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: RouteContext) {
    try {
        const { id } = await params;
        const { sectionIds } = await request.json();

        await prisma.examOwner.deleteMany({ where: { examId: id } });

        if (sectionIds && sectionIds.length > 0) {
            await prisma.examOwner.createMany({
                data: sectionIds.map((sid: string) => ({ examId: id, sectionId: sid }))
            });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to update exam owners" }, { status: 500 });
    }
}
