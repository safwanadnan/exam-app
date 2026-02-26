export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const prefSchema = z.object({
    examId: z.string().min(1),
    roomId: z.string().min(1),
    level: z.enum(["REQUIRED", "STRONGLY_PREFERRED", "PREFERRED", "NEUTRAL", "DISCOURAGED", "STRONGLY_DISCOURAGED", "PROHIBITED"]),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const examId = url.searchParams.get("examId");
    const where = examId ? { examId } : {};

    const preferences = await prisma.roomPreference.findMany({
        where,
        include: {
            exam: { select: { id: true, name: true } },
            room: { select: { id: true, name: true, capacity: true, building: { select: { code: true } } } },
        },
    });
    return jsonResponse({ preferences });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, prefSchema);
    if (parsed.error) return parsed.error;

    const pref = await prisma.roomPreference.upsert({
        where: { examId_roomId: { examId: parsed.data.examId, roomId: parsed.data.roomId } },
        create: parsed.data,
        update: { level: parsed.data.level },
        include: { room: { select: { name: true, building: { select: { code: true } } } } },
    });
    return jsonResponse(pref, 201);
});

export const DELETE = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const examId = url.searchParams.get("examId");
    const roomId = url.searchParams.get("roomId");
    if (!examId || !roomId) return jsonResponse({ error: "examId and roomId required" }, 400);

    await prisma.roomPreference.delete({
        where: { examId_roomId: { examId, roomId } },
    });
    return jsonResponse({ success: true });
});
