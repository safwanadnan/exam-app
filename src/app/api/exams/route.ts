export const dynamic = 'force-dynamic';
/**
 * GET /api/exams â€” List exams (filter by sessionId, examTypeId)
 * POST /api/exams â€” Create an exam
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, getPagination, withErrorHandling } from "@/lib/api-helpers";

const createExamSchema = z.object({
    name: z.string().optional(),
    examTypeId: z.string().min(1),
    length: z.number().int().min(1),
    altSeating: z.boolean().optional().default(false),
    maxRooms: z.number().int().optional().default(4),
    minSize: z.number().int().optional().default(0),
    sizeOverride: z.number().int().optional(),
    avgPeriod: z.number().int().optional().default(0),
    printOffset: z.number().int().optional(),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const { skip, limit, page } = getPagination(req);
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    const examTypeId = url.searchParams.get("examTypeId");
    const search = url.searchParams.get("search");
    const minimal = url.searchParams.get("minimal") === "true";

    const where: any = {};
    if (examTypeId) where.examTypeId = examTypeId;
    else if (sessionId) where.examType = { sessionId };
    
    if (search) {
        where.name = { contains: search, mode: 'insensitive' };
    }

    const queryArgs: any = {
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
    };

    if (minimal) {
        queryArgs.select = { id: true, name: true };
    } else {
        queryArgs.include = {
            examType: { select: { name: true, code: true } },
            _count: { select: { studentEnrollments: true, instructorAssignments: true } },
            owners: {
                include: { section: { include: { course: { select: { courseNumber: true, subjectId: true } } } } }
            },
            instructorAssignments: { include: { instructor: { select: { name: true } } } },
        };
    }

    const [exams, total] = await Promise.all([
        prisma.exam.findMany(queryArgs),
        prisma.exam.count({ where }),
    ]);
    return jsonResponse({ exams, total, page, limit });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, createExamSchema);
    if (parsed.error) return parsed.error;
    const exam = await prisma.exam.create({
        data: parsed.data,
        include: { examType: { select: { name: true, code: true } } },
    });
    return jsonResponse(exam, 201);
});

