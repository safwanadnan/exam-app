export const dynamic = 'force-dynamic';
/**
 * GET /api/solver/config â€” List solver configs for a session
 * POST /api/solver/config â€” Create a solver config
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const createConfigSchema = z.object({
    name: z.string().min(1),
    sessionId: z.string().min(1),
    isDefault: z.boolean().optional().default(false),
    // All weight parameters are optional â€” defaults come from the DB schema
    directConflictWeight: z.number().optional(),
    moreThan2ADayWeight: z.number().optional(),
    backToBackConflictWeight: z.number().optional(),
    distBackToBackConflictWeight: z.number().optional(),
    backToBackDistance: z.number().optional(),
    isDayBreakBackToBack: z.boolean().optional(),
    periodPenaltyWeight: z.number().optional(),
    periodIndexWeight: z.number().optional(),
    roomSizePenaltyWeight: z.number().optional(),
    roomSplitPenaltyWeight: z.number().optional(),
    roomPenaltyWeight: z.number().optional(),
    distributionWeight: z.number().optional(),
    largeExamPenaltyWeight: z.number().optional(),
    largeExamSize: z.number().optional(),
    maxRooms: z.number().int().optional(),
    timeout: z.number().int().optional(),
    useGreatDeluge: z.boolean().optional(),
    saInitialTemperature: z.number().optional(),
    saCoolingRate: z.number().optional(),
    hcMaxIdleIterations: z.number().int().optional(),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    const where = sessionId ? { sessionId } : {};

    const configs = await prisma.solverConfig.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
            _count: { select: { solverRuns: true } },
        },
    });
    return jsonResponse({ configs });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, createConfigSchema);
    if (parsed.error) return parsed.error;
    const config = await prisma.solverConfig.create({ data: parsed.data });
    return jsonResponse(config, 201);
});

