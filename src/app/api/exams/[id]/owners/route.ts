import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const owners = await prisma.examOwner.findMany({
            where: { examId: params.id },
            include: { section: { include: { course: { include: { subject: true } } } } }
        });
        return NextResponse.json({ owners });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch exam owners" }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const { sectionIds } = await request.json();

        // Remove existing and recreate
        await prisma.examOwner.deleteMany({
            where: { examId: params.id }
        });

        if (sectionIds && sectionIds.length > 0) {
            await prisma.examOwner.createMany({
                data: sectionIds.map((sid: string) => ({ examId: params.id, sectionId: sid }))
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update exam owners" }, { status: 500 });
    }
}
