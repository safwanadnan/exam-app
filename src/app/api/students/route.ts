export const dynamic = 'force-dynamic';
/**
 * GET /api/students â€” List students (filter by sessionId via exam enrollment)
 * POST /api/students â€” Create a student
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, getPagination, withErrorHandling } from "@/lib/api-helpers";

const createStudentSchema = z.object({
    externalId: z.string().min(1),
    name: z.string().min(1),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const { skip, limit, page } = getPagination(req);
    const url = new URL(req.url);
    const search = url.searchParams.get("search");
    const sessionId = url.searchParams.get("sessionId");

    const where: any = search
        ? {
            OR: [
                { name: { contains: search, mode: "insensitive" } as any },
                { externalId: { contains: search, mode: "insensitive" } as any },
            ]
        }
        : {};

    if (sessionId) {
        where.enrollments = { some: { exam: { examType: { sessionId } } } };
    }

    const [students, total] = await Promise.all([
        prisma.student.findMany({
            where,
            skip,
            take: limit,
            orderBy: { name: "asc" },
            include: {
                _count: { 
                    select: { 
                        enrollments: sessionId ? { where: { exam: { examType: { sessionId } } } } : true 
                    } 
                },
            },
        }),
        prisma.student.count({ where }),
    ]);
    return jsonResponse({ students, total, page, limit });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, createStudentSchema);
    if (parsed.error) return parsed.error;
    const student = await prisma.student.create({ data: parsed.data });
    return jsonResponse(student, 201);
});

