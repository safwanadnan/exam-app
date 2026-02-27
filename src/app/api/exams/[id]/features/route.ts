import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const preferences = await prisma.roomFeaturePreference.findMany({
            where: { examId: params.id },
            include: { feature: true }
        });
        return NextResponse.json({ preferences });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch exam feature preferences" }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const { features } = await request.json(); // { id: string, penalty: number }[]

        await prisma.roomFeaturePreference.deleteMany({
            where: { examId: params.id }
        });

        if (features && features.length > 0) {
            await prisma.roomFeaturePreference.createMany({
                data: features.map((f: any) => ({
                    examId: params.id,
                    featureId: f.id,
                    penalty: f.penalty
                }))
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update exam feature preferences" }, { status: 500 });
    }
}
