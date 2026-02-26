export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, errorResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const updatePeriodSchema = z.object({
    date: z.string().datetime().optional(),
    startTime: z.string().min(1).optional(),
    endTime: z.string().min(1).optional(),
    length: z.number().int().min(1).optional(),
    penalty: z.number().int().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export const PUT = withErrorHandling(async (req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    const parsed = await parseBody(req, updatePeriodSchema);
    if (parsed.error) return parsed.error;
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.date) data.date = new Date(parsed.data.date);
    const period = await prisma.examPeriod.update({ where: { id }, data });
    return jsonResponse(period);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    await prisma.examPeriod.delete({ where: { id } });
    return jsonResponse({ deleted: true });
});
