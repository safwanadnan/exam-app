export const dynamic = 'force-dynamic';
/**
 * POST /api/solver/runs/[id]/stop — Stop a solver run
 */
import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, withErrorHandling, prisma } from "@/lib/api-helpers";
import { stopSolverRun } from "@/lib/solver-manager";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (_req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;

    const stopped = stopSolverRun(id);

    if (stopped) {
        return jsonResponse({ success: true, message: "Stop signal sent to solver." });
    } else {
        // If not active in memory, check if it's stuck in DB
        const run = await prisma.solverRun.findUnique({ where: { id } });
        if (run && ["PENDING", "RUNNING", "PHASE_1", "PHASE_2", "PHASE_3", "FINALIZATION"].includes(run.status)) {
            await prisma.solverRun.update({
                where: { id },
                data: { status: "FAILED", log: JSON.stringify({ error: "Run was cleared manually because the solver process died." }) }
            });
            return jsonResponse({ success: true, message: "Cleared stuck run from database." });
        }
        return errorResponse("Solver run not found or not active.", 404);
    }
});
