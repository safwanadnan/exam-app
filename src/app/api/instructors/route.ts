export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const instructorSchema = z.object({
    externalId: z.string().min(1, "External ID is required"),
    name: z.string().min(1, "Name is required"),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const sessionId = url.searchParams.get("sessionId");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const where: any = search ? {
        OR: [
            { name: { contains: search, mode: "insensitive" } as any },
            { externalId: { contains: search, mode: "insensitive" } as any },
        ],
    } : {};

    if (sessionId) {
        where.assignments = { some: { exam: { examType: { sessionId } } } };
    }

    const [instructors, total] = await Promise.all([
        prisma.instructor.findMany({
            where,
            include: {
                _count: { 
                    select: { 
                        assignments: sessionId ? { where: { exam: { examType: { sessionId } } } } : true 
                    } 
                },
            },
            orderBy: { name: "asc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.instructor.count({ where }),
    ]);

    return jsonResponse({ instructors, total, page, limit });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, instructorSchema);
    if (parsed.error) return parsed.error;

    const instructor = await prisma.instructor.create({
        data: parsed.data,
        include: { _count: { select: { assignments: true } } },
    });

    return jsonResponse(instructor, 201);
});
