export const dynamic = 'force-dynamic';
/**
 * GET /api/campuses — List all campuses
 * POST /api/campuses — Create a campus
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, getPagination, getSearch, withErrorHandling, buildSearchOR } from "@/lib/api-helpers";

const createCampusSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const { skip, limit, page } = getPagination(req);
    const search = getSearch(req);
    const exact = new URL(req.url).searchParams.get("exact") === "true";

    const where = search
        ? { OR: buildSearchOR(search, [["name"], ["code"]], exact) ?? [] }
        : {};

    const [campuses, total] = await Promise.all([
        prisma.campus.findMany({
            where,
            skip,
            take: limit,
            orderBy: { code: "asc" },
            include: { _count: { select: { buildings: true } } },
        }),
        prisma.campus.count({ where }),
    ]);
    return jsonResponse({ campuses, total, page, limit });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, createCampusSchema);
    if (parsed.error) return parsed.error;
    const campus = await prisma.campus.create({ data: parsed.data });
    return jsonResponse(campus, 201);
});
