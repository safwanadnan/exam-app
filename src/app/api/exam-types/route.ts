/**
 * GET /api/exam-types — List exam types for a session
 * POST /api/exam-types — Create an exam type
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const createExamTypeSchema = z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    sessionId: z.string().min(1),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    const where = sessionId ? { sessionId } : {};

    const examTypes = await prisma.examType.findMany({
        where,
        orderBy: { name: "asc" },
        include: {
            _count: { select: { exams: true, periods: true } },
        },
    });
    return jsonResponse({ examTypes });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, createExamTypeSchema);
    if (parsed.error) return parsed.error;
    const examType = await prisma.examType.create({ data: parsed.data });
    return jsonResponse(examType, 201);
});
