import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const unavailability = await prisma.instructorUnavailability.findMany({
            where: { instructorId: params.id },
            include: { period: true }
        });
        return NextResponse.json({ unavailability });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch unavailability" }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const { periodIds } = await request.json();

        await prisma.instructorUnavailability.deleteMany({
            where: { instructorId: params.id }
        });

        if (periodIds && periodIds.length > 0) {
            await prisma.instructorUnavailability.createMany({
                data: periodIds.map((pid: string) => ({ instructorId: params.id, periodId: pid }))
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update unavailability" }, { status: 500 });
    }
}
