import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
    try {
        const { id } = await params;
        const unavailability = await prisma.roomPeriodAvailability.findMany({
            where: { roomId: id, available: false },
            include: { period: true }
        });
        return NextResponse.json({ unavailability });
    } catch {
        return NextResponse.json({ error: "Failed to fetch unavailability" }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: RouteContext) {
    try {
        const { id } = await params;
        const { periodIds } = await request.json();

        await prisma.roomPeriodAvailability.deleteMany({ where: { roomId: id } });

        if (periodIds && periodIds.length > 0) {
            await prisma.roomPeriodAvailability.createMany({
                data: periodIds.map((pid: string) => ({
                    roomId: id,
                    periodId: pid,
                    available: false,
                    penalty: -1
                }))
            });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to update unavailability" }, { status: 500 });
    }
}
