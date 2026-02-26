export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, errorResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const updateBuildingSchema = z.object({
    code: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    coordX: z.number().optional(),
    coordY: z.number().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export const PUT = withErrorHandling(async (req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    const parsed = await parseBody(req, updateBuildingSchema);
    if (parsed.error) return parsed.error;
    const building = await prisma.building.update({ where: { id }, data: parsed.data });
    return jsonResponse(building);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    await prisma.building.delete({ where: { id } });
    return jsonResponse({ deleted: true });
});
