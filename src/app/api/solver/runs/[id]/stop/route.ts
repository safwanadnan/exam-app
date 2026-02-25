/**
 * POST /api/solver/runs/[id]/stop — Stop a solver run
 */
import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, withErrorHandling } from "@/lib/api-helpers";
import { stopSolverRun } from "@/lib/solver-manager";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (_req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;

    const stopped = stopSolverRun(id);

    if (stopped) {
        return jsonResponse({ success: true, message: "Stop signal sent to solver." });
    } else {
        return errorResponse("Solver run not found or not active.", 404);
    }
});
