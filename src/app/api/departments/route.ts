import { NextRequest, NextResponse } from "next/server";
import { prisma, jsonResponse, getPagination, withErrorHandling, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

export const GET = withErrorHandling(async (req: NextRequest) => {
    const { skip, limit, page } = getPagination(req);
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    const where = sessionId ? { sessionId } : {};

    const [departments, total] = await Promise.all([
        prisma.department.findMany({
            where,
            include: { _count: { select: { subjects: true } } },
            orderBy: { code: 'asc' },
            skip,
            take: limit,
        }),
        prisma.department.count({ where })
    ]);
    return jsonResponse({ departments, total, page, limit });
});

const departmentSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    sessionId: z.string().min(1),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, departmentSchema);
    if (parsed.error) return parsed.error;

    const department = await prisma.department.create({
        data: parsed.data
    });
    return jsonResponse(department, 201);
});
