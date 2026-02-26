export const dynamic = 'force-dynamic';
/**
 * GET /api/rooms â€” List rooms (optionally filter by buildingId)
 * POST /api/rooms â€” Create a room
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, getPagination, withErrorHandling } from "@/lib/api-helpers";

const createRoomSchema = z.object({
    name: z.string().min(1),
    buildingId: z.string().min(1),
    capacity: z.number().int().min(1),
    altCapacity: z.number().int().min(1).optional(),
    coordX: z.number().optional(),
    coordY: z.number().optional(),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const { skip, limit, page } = getPagination(req);
    const url = new URL(req.url);
    const buildingId = url.searchParams.get("buildingId");

    const where = buildingId ? { buildingId } : {};
    const [rooms, total] = await Promise.all([
        prisma.room.findMany({
            where,
            skip,
            take: limit,
            orderBy: { name: "asc" },
            include: { building: { select: { code: true, name: true } } },
        }),
        prisma.room.count({ where }),
    ]);
    return jsonResponse({ rooms, total, page, limit });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, createRoomSchema);
    if (parsed.error) return parsed.error;
    const room = await prisma.room.create({
        data: parsed.data,
        include: { building: { select: { code: true, name: true } } },
    });
    return jsonResponse(room, 201);
});

