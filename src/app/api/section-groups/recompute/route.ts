import { NextResponse } from "next/server";
import { recomputeSectionGroups } from "@/lib/section-groups";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/section-groups/recompute?sessionId=...
 * Rebuilds section groups and SAME_PERIOD constraints using default sync rules.
 */
export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    try {
        const result = await recomputeSectionGroups(prisma, sessionId);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("Failed to recompute section groups:", error);
        return NextResponse.json({ error: "Failed to recompute section groups" }, { status: 500 });
    }
}