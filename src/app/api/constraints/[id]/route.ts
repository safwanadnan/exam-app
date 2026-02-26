export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, errorResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const updateConstraintSchema = z.object({
    type: z.string().min(1).optional(),
    hard: z.boolean().optional(),
    weight: z.number().int().optional(),
    examAId: z.string().min(1).optional(),
    examBId: z.string().min(1).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export const PUT = withErrorHandling(async (req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    const parsed = await parseBody(req, updateConstraintSchema);
    if (parsed.error) return parsed.error;
    const constraint = await prisma.distributionConstraint.update({
        where: { id },
        data: parsed.data,
        include: { examA: { select: { name: true } }, examB: { select: { name: true } } },
    });
    return jsonResponse(constraint);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    await prisma.distributionConstraint.delete({ where: { id } });
    return jsonResponse({ deleted: true });
});
