import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const assignments = await prisma.roomFeatureAssignment.findMany({
            where: { roomId: params.id },
            include: { feature: true }
        });
        return NextResponse.json({ assignments });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch room features" }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const { featureIds } = await request.json();

        await prisma.roomFeatureAssignment.deleteMany({
            where: { roomId: params.id }
        });

        if (featureIds && featureIds.length > 0) {
            await prisma.roomFeatureAssignment.createMany({
                data: featureIds.map((fid: string) => ({ roomId: params.id, featureId: fid }))
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update room features" }, { status: 500 });
    }
}
