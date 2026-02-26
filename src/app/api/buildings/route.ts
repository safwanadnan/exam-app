export const dynamic = 'force-dynamic';
/**
 * GET /api/buildings â€” List all buildings with rooms
 * POST /api/buildings â€” Create a building
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, getPagination, withErrorHandling } from "@/lib/api-helpers";

const createBuildingSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    coordX: z.number().optional(),
    coordY: z.number().optional(),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const { skip, limit, page } = getPagination(req);
    const [buildings, total] = await Promise.all([
        prisma.building.findMany({
            skip,
            take: limit,
            orderBy: { code: "asc" },
            include: {
                rooms: { orderBy: { name: "asc" } },
                _count: { select: { rooms: true } },
            },
        }),
        prisma.building.count(),
    ]);
    return jsonResponse({ buildings, total, page, limit });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, createBuildingSchema);
    if (parsed.error) return parsed.error;
    const building = await prisma.building.create({ data: parsed.data });
    return jsonResponse(building, 201);
});

