import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    try {
        const features = await prisma.roomFeature.findMany({
            where: sessionId ? { sessionId } : undefined,
            orderBy: { name: 'asc' }
        });
        return NextResponse.json({ features });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch features" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const feature = await prisma.roomFeature.create({
            data: {
                name: body.name,
                code: body.code,
                sessionId: body.sessionId,
            }
        });
        return NextResponse.json({ feature });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create feature" }, { status: 500 });
    }
}
