export const dynamic = 'force-dynamic';
/**
 * GET /api/solver/config – List solver configs for a session
 * POST /api/solver/config – Create a solver config
 */
import { NextRequest } from "next/server";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";
import { solverConfigSchema } from "@/lib/validations";


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
    const parsed = await parseBody(req, solverConfigSchema);
    if (parsed.error) return parsed.error;
    const config = await prisma.solverConfig.create({ data: parsed.data });
    return jsonResponse(config, 201);
});
