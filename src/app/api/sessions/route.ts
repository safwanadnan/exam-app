/**
 * GET /api/sessions — List all academic sessions
 * POST /api/sessions — Create a new academic session
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, errorResponse, parseBody, getPagination, withErrorHandling } from "@/lib/api-helpers";

const createSessionSchema = z.object({
    name: z.string().min(1),
    year: z.number().int().min(2000).max(2100),
    term: z.string().min(1),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    isActive: z.boolean().optional().default(false),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const { skip, limit, page } = getPagination(req);
    const [sessions, total] = await Promise.all([
        prisma.academicSession.findMany({
            skip,
            take: limit,
            orderBy: { year: "desc" },
            include: {
                _count: { select: { examTypes: true, solverRuns: true } },
            },
        }),
        prisma.academicSession.count(),
    ]);
    return jsonResponse({ sessions, total, page, limit });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, createSessionSchema);
    if (parsed.error) return parsed.error;

    const session = await prisma.academicSession.create({
        data: {
            ...parsed.data,
            startDate: new Date(parsed.data.startDate),
            endDate: new Date(parsed.data.endDate),
        },
    });
    return jsonResponse(session, 201);
});
