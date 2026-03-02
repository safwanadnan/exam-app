export const dynamic = 'force-dynamic';
/**
 * GET /api/solver/runs/[id] - Get detailed solver run info including diagnostics
 */
import { NextRequest } from "next/server";
import { prisma, jsonResponse, withErrorHandling } from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;

    const run = await prisma.solverRun.findUnique({
        where: { id },
        include: { config: { select: { name: true } } },
    });

    if (!run) {
        return jsonResponse({ error: "Solver run not found" }, 404);
    }

    // Parse the log field as JSON diagnostics
    let diagnostics = null;
    if (run.log) {
        try {
            diagnostics = JSON.parse(run.log);
        } catch {
            diagnostics = null;
        }
    }

    return jsonResponse({
        ...run,
        diagnostics,
    });
});
