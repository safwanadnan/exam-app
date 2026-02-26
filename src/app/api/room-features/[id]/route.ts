export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const updateSchema = z.object({
    code: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    type: z.enum(["BOOLEAN", "NUMERIC"]).optional(),
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: any) => {
    const { id } = await params;
    await prisma.roomFeature.delete({ where: { id } });
    return jsonResponse({ success: true });
});

export const PUT = withErrorHandling(async (req: NextRequest, { params }: any) => {
    const { id } = await params;
    const parsed = await parseBody(req, updateSchema);
    if (parsed.error) return parsed.error;

    const feature = await prisma.roomFeature.update({
        where: { id },
        data: parsed.data,
    });
    return jsonResponse(feature);
});
