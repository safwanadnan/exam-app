import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
    try {
        const { id } = await params;
        const assignments = await prisma.roomFeatureAssignment.findMany({
            where: { roomId: id },
            include: { feature: true }
        });
        return NextResponse.json({ assignments });
    } catch {
        return NextResponse.json({ error: "Failed to fetch room features" }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: RouteContext) {
    try {
        const { id } = await params;
        const { featureIds } = await request.json();

        await prisma.roomFeatureAssignment.deleteMany({ where: { roomId: id } });

        if (featureIds && featureIds.length > 0) {
            await prisma.roomFeatureAssignment.createMany({
                data: featureIds.map((fid: string) => ({ roomId: id, featureId: fid }))
            });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to update room features" }, { status: 500 });
    }
}
