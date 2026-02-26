export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const configSchema = z.object({
    name: z.string().min(1),
    sessionId: z.string().min(1),
    isDefault: z.boolean().default(false),
    directConflictWeight: z.number().default(1000),
    moreThan2ADayWeight: z.number().default(100),
    backToBackConflictWeight: z.number().default(10),
    distBackToBackConflictWeight: z.number().default(25),
    backToBackDistance: z.number().default(67),
    isDayBreakBackToBack: z.boolean().default(false),
    periodPenaltyWeight: z.number().default(1),
    roomSizePenaltyWeight: z.number().default(0.001),
    roomSplitPenaltyWeight: z.number().default(10),
    roomPenaltyWeight: z.number().default(1),
    distributionWeight: z.number().default(1),
    largeExamPenaltyWeight: z.number().default(1),
    largeExamSize: z.number().default(0),
    instructorDirectConflictWeight: z.number().default(1000),
    instructorMoreThan2ADayWeight: z.number().default(100),
    instructorBackToBackConflictWeight: z.number().default(10),
    instructorDistBackToBackWeight: z.number().default(25),
    maxRooms: z.number().int().default(4),
    timeout: z.number().int().default(600),
}).partial().required({ name: true, sessionId: true });

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, configSchema);
    if (parsed.error) return parsed.error;

    const config = await prisma.solverConfig.create({ data: parsed.data as any });
    return jsonResponse(config, 201);
});

export const PUT = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ error: "id required" }, 400);

    const body = await req.json();
    const { id: _, createdAt, updatedAt, session, solverRuns, ...data } = body;

    const config = await prisma.solverConfig.update({ where: { id }, data });
    return jsonResponse(config);
});

export const DELETE = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ error: "id required" }, 400);

    await prisma.solverConfig.delete({ where: { id } });
    return jsonResponse({ success: true });
});
