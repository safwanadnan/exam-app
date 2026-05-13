export const dynamic = 'force-dynamic';
/**
 * GET /api/campuses/[id] — Get a single campus
 * PUT /api/campuses/[id] — Update a campus
 * DELETE /api/campuses/[id] — Delete a campus
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const updateCampusSchema = z.object({
    code: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
});

export const GET = withErrorHandling(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const p = await params;
    const campus = await prisma.campus.findUnique({
        where: { id: p.id },
        include: { _count: { select: { buildings: true } } },
    });
    if (!campus) return jsonResponse({ error: "Campus not found" }, 404);
    return jsonResponse(campus);
});

export const PUT = withErrorHandling(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const p = await params;
    const parsed = await parseBody(req, updateCampusSchema);
    if (parsed.error) return parsed.error;

    try {
        const campus = await prisma.campus.update({
            where: { id: p.id },
            data: parsed.data,
        });
        return jsonResponse(campus);
    } catch (error: any) {
        if (error.code === 'P2025') return jsonResponse({ error: "Campus not found" }, 404);
        throw error;
    }
});

export const DELETE = withErrorHandling(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const p = await params;
    try {
        await prisma.campus.delete({ where: { id: p.id } });
        return jsonResponse({ success: true });
    } catch (error: any) {
        if (error.code === 'P2025') return jsonResponse({ error: "Campus not found" }, 404);
        throw error;
    }
});
