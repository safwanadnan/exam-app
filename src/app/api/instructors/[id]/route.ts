export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const updateSchema = z.object({
    externalId: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
});

export const GET = withErrorHandling(async (_req: NextRequest, { params }: any) => {
    const { id } = await params;
    const instructor = await prisma.instructor.findUniqueOrThrow({
        where: { id },
        include: {
            assignments: {
                include: { exam: { select: { id: true, name: true, length: true, size: true } } },
            },
            unavailability: true,
        },
    });
    return jsonResponse(instructor);
});

export const PUT = withErrorHandling(async (req: NextRequest, { params }: any) => {
    const { id } = await params;
    const parsed = await parseBody(req, updateSchema);
    if (parsed.error) return parsed.error;

    const instructor = await prisma.instructor.update({
        where: { id },
        data: parsed.data,
        include: { _count: { select: { assignments: true } } },
    });

    return jsonResponse(instructor);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: any) => {
    const { id } = await params;
    await prisma.instructor.delete({ where: { id } });
    return jsonResponse({ success: true });
});
