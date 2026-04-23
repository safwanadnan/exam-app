export const dynamic = 'force-dynamic';
/**
 * POST /api/solver/runs â€” Create a new solver run and start it
 * GET /api/solver/runs â€” List past solver runs
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, getPagination, withErrorHandling } from "@/lib/api-helpers";
import { startSolverRun, activeSolvers } from "@/lib/solver-manager";

const createRunSchema = z.object({
    sessionId: z.string().min(1),
    configId: z.string().min(1),
    warmStartRunId: z.string().min(1).optional(),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
    const { skip, limit, page } = getPagination(req);
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    const where = sessionId ? { sessionId } : {};

    const [runs, total] = await Promise.all([
        prisma.solverRun.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: { config: { select: { name: true } } },
        }),
        prisma.solverRun.count({ where }),
    ]);

    // Enhance with active status from memory if running
    const enhancedRuns = runs.map((run: any) => {
        const activeState = activeSolvers.get(run.id);
        if (activeState && (run.status === "PENDING" || run.status === "RUNNING")) {
            return {
                ...run,
                status: activeState.solver.getStatus(),
                phase: activeState.solver.getPhase(),
                liveProgress: activeState.latestProgress,
            };
        }
        return run;
    });

    return jsonResponse({ runs: enhancedRuns, total, page, limit });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, createRunSchema);
    if (parsed.error) return parsed.error;

    const { sessionId, configId, warmStartRunId } = parsed.data;

    // Validate warm start run if provided
    if (warmStartRunId) {
        const prevRun = await prisma.solverRun.findUnique({
            where: { id: warmStartRunId },
        });
        if (!prevRun || prevRun.sessionId !== sessionId) {
            return jsonResponse(
                { error: "Invalid warm start run", details: "Run not found or belongs to different session" },
                400
            );
        }
    }

    // 1. Create run record
    const run = await prisma.solverRun.create({
        data: {
            sessionId,
            configId,
            warmStartRunId,
            status: "PENDING",
        },
    });

    // 2. Start solver in background
    try {
        await startSolverRun(run.id, sessionId, configId, warmStartRunId);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        await prisma.solverRun.update({
            where: { id: run.id },
            data: { status: "FAILED", log: JSON.stringify({ error: msg }) },
        });
        return jsonResponse({ error: "Failed to start solver", details: msg }, 500);
    }

    return jsonResponse({ run, message: "Solver started" }, 202);
});

