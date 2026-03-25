import { NextRequest, NextResponse } from "next/server";
import { prisma, jsonResponse, getPagination, withErrorHandling, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

export const GET = withErrorHandling(async (req: NextRequest) => {
    const { skip, limit, page } = getPagination(req);
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    const where = sessionId ? { sessionId } : {};

    const [features, total] = await Promise.all([
        prisma.roomFeature.findMany({
            where,
            orderBy: { name: 'asc' },
            skip,
            take: limit,
        }),
        prisma.roomFeature.count({ where })
    ]);
    return jsonResponse({ features, total, page, limit });
});

const featureSchema = z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    sessionId: z.string().min(1),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, featureSchema);
    if (parsed.error) return parsed.error;

    const feature = await prisma.roomFeature.create({
        data: parsed.data
    });
    return jsonResponse(feature, 201);
});
