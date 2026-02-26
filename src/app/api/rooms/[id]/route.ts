export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, errorResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const updateRoomSchema = z.object({
    name: z.string().min(1).optional(),
    buildingId: z.string().min(1).optional(),
    capacity: z.number().int().min(1).optional(),
    altCapacity: z.number().int().min(1).optional().nullable(),
    coordX: z.number().optional().nullable(),
    coordY: z.number().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export const PUT = withErrorHandling(async (req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    const parsed = await parseBody(req, updateRoomSchema);
    if (parsed.error) return parsed.error;
    const room = await prisma.room.update({
        where: { id },
        data: parsed.data,
        include: { building: { select: { code: true, name: true } } },
    });
    return jsonResponse(room);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    await prisma.room.delete({ where: { id } });
    return jsonResponse({ deleted: true });
});
