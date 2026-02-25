/**
 * GET /api/sessions/[id] — Get a session by ID
 * PUT /api/sessions/[id] — Update a session
 * DELETE /api/sessions/[id] — Delete a session
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, errorResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const updateSessionSchema = z.object({
    name: z.string().min(1).optional(),
    year: z.number().int().optional(),
    term: z.string().min(1).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    const session = await prisma.academicSession.findUnique({
        where: { id },
        include: {
            examTypes: { include: { periods: true, _count: { select: { exams: true } } } },
            _count: { select: { departments: true, courses: true, solverRuns: true } },
        },
    });
    if (!session) return errorResponse("Session not found", 404);
    return jsonResponse(session);
});

export const PUT = withErrorHandling(async (req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    const parsed = await parseBody(req, updateSessionSchema);
    if (parsed.error) return parsed.error;

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate);
    if (parsed.data.endDate) data.endDate = new Date(parsed.data.endDate);

    const session = await prisma.academicSession.update({ where: { id }, data });
    return jsonResponse(session);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    await prisma.academicSession.delete({ where: { id } });
    return jsonResponse({ deleted: true });
});
