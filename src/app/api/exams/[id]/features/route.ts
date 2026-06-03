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
        const mappedPreferences = preferences.map(p => ({
            ...p,
            penalty: p.level === "REQUIRED" ? -1 : 1
        }));
        return NextResponse.json({ preferences: mappedPreferences });
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
                            const level = penalty === -1 ? "REQUIRED" : "PREFERRED";
                            return { examId: id, featureId: fid, level };
                        }
                    }
                    return null;
                })
                .filter(Boolean) as { examId: string; featureId: string; level: string }[];

            if (data.length > 0) {
                await prisma.roomFeaturePreference.createMany({ data });
            }
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to update exam feature preferences" }, { status: 500 });
    }
}

