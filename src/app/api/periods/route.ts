export const dynamic = 'force-dynamic';
/**
 * GET /api/periods â€” List periods (filter by sessionId, examTypeId)
 * POST /api/periods â€” Create a period
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, getPagination, getSearch, withErrorHandling } from "@/lib/api-helpers";

const createPeriodSchema = z.object({
    examTypeId: z.string().min(1),
    date: z.string().datetime(),
    startTime: z.string().min(1), // "08:00"
    endTime: z.string().min(1),
    length: z.number().int().min(1),
    day: z.number().int().min(0),
    timeIndex: z.number().int().min(0),
    penalty: z.number().int().optional().default(0),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const { skip, limit, page } = getPagination(req);
    const search = getSearch(req);
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    const examTypeId = url.searchParams.get("examTypeId");

    const where: any = {};
    if (examTypeId) where.examTypeId = examTypeId;
    else if (sessionId) where.examType = { sessionId };

    if (search) {
        where.OR = [
            { startTime: { contains: search } },
            { examType: { name: { contains: search } } },
            { examType: { code: { contains: search } } },
        ];
    }

    const [periods, total] = await Promise.all([
        prisma.examPeriod.findMany({
            where,
            skip,
            take: limit,
            orderBy: [{ date: "asc" }, { startTime: "asc" }],
            include: {
                examType: { select: { name: true, code: true } },
                _count: { select: { examAssignments: true } },
            },
        }),
        prisma.examPeriod.count({ where }),
    ]);
    return jsonResponse({ periods, total, page, limit });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, createPeriodSchema);
    if (parsed.error) return parsed.error;
    const period = await prisma.examPeriod.create({
        data: {
            ...parsed.data,
            date: new Date(parsed.data.date),
        },
        include: { examType: { select: { name: true, code: true } } },
    });
    return jsonResponse(period, 201);
});

