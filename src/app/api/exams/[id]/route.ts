export const dynamic = 'force-dynamic';
/**
 * GET /api/exams/[id] — Get exam with full details
 * PUT /api/exams/[id] — Update exam
 * DELETE /api/exams/[id] — Delete exam
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, errorResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const updateExamSchema = z.object({
    name: z.string().optional(),
    length: z.number().int().min(1).optional(),
    altSeating: z.boolean().optional(),
    maxRooms: z.number().int().optional(),
    minSize: z.number().int().optional(),
    sizeOverride: z.number().int().nullable().optional(),
    avgPeriod: z.number().int().optional(),
    printOffset: z.number().int().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    const exam = await prisma.exam.findUnique({
        where: { id },
        include: {
            examType: true,
            owners: { include: { section: { include: { course: { include: { subject: true } } } } } },
            studentEnrollments: { include: { student: { select: { id: true, externalId: true, name: true } } } },
            instructorAssignments: { include: { instructor: { select: { id: true, externalId: true, name: true } } } },
            periodPreferences: { include: { period: true } },
            roomPreferences: { include: { room: { include: { building: { select: { code: true } } } } } },
            distributionConstraintsA: { include: { examB: { select: { id: true, name: true } } } },
            distributionConstraintsB: { include: { examA: { select: { id: true, name: true } } } },
            assignment: { include: { period: true, rooms: { include: { room: true } } } },
        },
    });
    if (!exam) return errorResponse("Exam not found", 404);
    return jsonResponse(exam);
});

export const PUT = withErrorHandling(async (req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    const parsed = await parseBody(req, updateExamSchema);
    if (parsed.error) return parsed.error;
    const exam = await prisma.exam.update({ where: { id }, data: parsed.data });
    return jsonResponse(exam);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    await prisma.exam.delete({ where: { id } });
    return jsonResponse({ deleted: true });
});
