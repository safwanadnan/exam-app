export const dynamic = 'force-dynamic';
/**
 * GET /api/constraints — List distribution constraints
 * POST /api/constraints — Create a distribution constraint
 * DELETE /api/constraints — Bulk delete distribution constraints
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, getPagination, getSearch, withErrorHandling } from "@/lib/api-helpers";

const createConstraintSchema = z.object({
    type: z.string().min(1),
    hard: z.boolean().optional().default(false),
    weight: z.number().int().optional().default(1),
    examAId: z.string().min(1),
    examBId: z.string().min(1),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const { skip, limit, page } = getPagination(req);
    const search = getSearch(req);
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    const where: any = sessionId ? { 
        OR: [
            { examA: { examType: { sessionId } } },
            { examB: { examType: { sessionId } } }
        ]
    } : {};

    if (search) {
        const searchCond = {
            OR: [
                { type: { contains: search } },
                { examA: { name: { contains: search } } },
                { examB: { name: { contains: search } } },
            ]
        };
        if (where.OR) {
            // Combine with sessionId filter
            where.AND = [
                { OR: where.OR },
                searchCond
            ];
            delete where.OR;
        } else {
            where.OR = searchCond.OR;
        }
    }

    const [constraints, total] = await Promise.all([
        prisma.distributionConstraint.findMany({
            where,
            skip,
            take: limit,
            include: {
                examA: { select: { name: true, examType: { select: { name: true } } } },
                examB: { select: { name: true } },
            },
        }),
        prisma.distributionConstraint.count({ where }),
    ]);

    return jsonResponse({ constraints, total, page, limit });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, createConstraintSchema);
    if (parsed.error) return parsed.error;

    const constraint = await prisma.distributionConstraint.create({
        data: parsed.data,
        include: {
            examA: { select: { name: true } },
            examB: { select: { name: true } },
        }
    });

    return jsonResponse(constraint, 201);
});

export const DELETE = withErrorHandling(async (req: NextRequest) => {
    try {
        const { ids } = await req.json();
        if (!Array.isArray(ids) || ids.length === 0) {
            return jsonResponse({ error: "IDs are required" }, 400);
        }

        await prisma.distributionConstraint.deleteMany({
            where: { id: { in: ids } }
        });

        return jsonResponse({ success: true, count: ids.length });
    } catch (e) {
        return jsonResponse({ error: "Failed to delete constraints" }, 500);
    }
});
