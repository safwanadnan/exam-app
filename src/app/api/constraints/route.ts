export const dynamic = 'force-dynamic';
/**
 * GET /api/constraints â€” List distribution constraints
 * POST /api/constraints â€” Create a distribution constraint
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, getPagination, withErrorHandling } from "@/lib/api-helpers";

const createConstraintSchema = z.object({
    type: z.string().min(1),
    hard: z.boolean().optional().default(false),
    weight: z.number().int().optional().default(1),
    examAId: z.string().min(1),
    examBId: z.string().min(1),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const { skip, limit, page } = getPagination(req);

    const [constraints, total] = await Promise.all([
        prisma.distributionConstraint.findMany({
            skip,
            take: limit,
            include: {
                examA: { select: { name: true, examType: { select: { name: true } } } },
                examB: { select: { name: true } },
            },
        }),
        prisma.distributionConstraint.count(),
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

