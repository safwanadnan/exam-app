import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
    try {
        const { id } = await params;
        const preferences = await prisma.roomFeaturePreference.findMany({
            where: { examId: id },
            include: { feature: true }
        });
        return NextResponse.json({ preferences });
    } catch {
        return NextResponse.json({ error: "Failed to fetch exam feature preferences" }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: RouteContext) {
    try {
        const { id } = await params;
        const { features } = await request.json();

        await prisma.roomFeaturePreference.deleteMany({ where: { examId: id } });

        if (features && features.length > 0) {
            await prisma.roomFeaturePreference.createMany({
                data: features.map((f: any) => ({
                    examId: id,
                    featureId: f.id,
                    penalty: f.penalty
                }))
            });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to update exam feature preferences" }, { status: 500 });
    }
}
