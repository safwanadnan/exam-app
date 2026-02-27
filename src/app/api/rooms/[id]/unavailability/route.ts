import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const unavailability = await prisma.roomPeriodAvailability.findMany({
            where: { roomId: params.id, available: false },
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

        await prisma.roomPeriodAvailability.deleteMany({
            where: { roomId: params.id }
        });

        if (periodIds && periodIds.length > 0) {
            await prisma.roomPeriodAvailability.createMany({
                data: periodIds.map((pid: string) => ({
                    roomId: params.id,
                    periodId: pid,
                    available: false, // Explicitly marking as a blackout period
                    penalty: -1       // Prohibited
                }))
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update unavailability" }, { status: 500 });
    }
}
