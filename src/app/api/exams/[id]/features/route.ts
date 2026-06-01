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
        const body = await request.json().catch(() => null) as unknown;

        await prisma.roomFeaturePreference.deleteMany({ where: { examId: id } });

        if (body && typeof body === "object" && Array.isArray((body as any).features)) {
            const raw = (body as any).features as unknown[];
            const data = raw
                .map(item => {
                    if (item && typeof item === "object") {
                        const fid = (item as any).id;
                        const penalty = (item as any).penalty;
                        if (typeof fid === "string") {
                            return { examId: id, featureId: fid, penalty: typeof penalty === "number" ? penalty : undefined };
                        }
                    }
                    return null;
                })
                .filter(Boolean) as { examId: string; featureId: string; penalty?: number }[];

            if (data.length > 0) {
                await prisma.roomFeaturePreference.createMany({ data });
            }
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to update exam feature preferences" }, { status: 500 });
    }
}
