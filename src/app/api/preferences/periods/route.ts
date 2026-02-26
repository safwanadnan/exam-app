export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const prefSchema = z.object({
    examId: z.string().min(1),
    periodId: z.string().min(1),
    level: z.enum(["REQUIRED", "STRONGLY_PREFERRED", "PREFERRED", "NEUTRAL", "DISCOURAGED", "STRONGLY_DISCOURAGED", "PROHIBITED"]),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const examId = url.searchParams.get("examId");
    const where = examId ? { examId } : {};

    const preferences = await prisma.periodPreference.findMany({
        where,
        include: {
            exam: { select: { id: true, name: true } },
            period: { select: { id: true, date: true, startTime: true, endTime: true, day: true } },
        },
    });
    return jsonResponse({ preferences });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, prefSchema);
    if (parsed.error) return parsed.error;

    const pref = await prisma.periodPreference.upsert({
        where: { examId_periodId: { examId: parsed.data.examId, periodId: parsed.data.periodId } },
        create: parsed.data,
        update: { level: parsed.data.level },
        include: { period: { select: { date: true, startTime: true, endTime: true } } },
    });
    return jsonResponse(pref, 201);
});

export const DELETE = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const examId = url.searchParams.get("examId");
    const periodId = url.searchParams.get("periodId");
    if (!examId || !periodId) return jsonResponse({ error: "examId and periodId required" }, 400);

    await prisma.periodPreference.delete({
        where: { examId_periodId: { examId, periodId } },
    });
    return jsonResponse({ success: true });
});
