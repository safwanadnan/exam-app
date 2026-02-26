export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const featureSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(["BOOLEAN", "NUMERIC"]).default("BOOLEAN"),
});

export const GET = withErrorHandling(async (_req: NextRequest) => {
    const features = await prisma.roomFeature.findMany({
        include: { _count: { select: { assignments: true } } },
        orderBy: { name: "asc" },
    });
    return jsonResponse({ features });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, featureSchema);
    if (parsed.error) return parsed.error;

    const feature = await prisma.roomFeature.create({
        data: parsed.data,
        include: { _count: { select: { assignments: true } } },
    });
    return jsonResponse(feature, 201);
});
