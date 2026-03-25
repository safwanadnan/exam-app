/**
 * GET /api/solver/runs/[id]/progress — Server-Sent Events (SSE) for live solver progress
 */
import { NextRequest } from "next/server";
import { activeSolvers } from "@/lib/solver-manager";
import { prisma } from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: RouteContext) {
    const { id } = await ctx.params;
    const state = activeSolvers.get(id);

    if (!state) {
        // Fallback for multi-worker/dev mode: stream progress from DB snapshots.
        const run = await prisma.solverRun.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                phase: true,
                iterations: true,
                totalExams: true,
                assignedExams: true,
                directConflicts: true,
                backToBackConflicts: true,
                moreThan2ADay: true,
                totalPenalty: true,
                bestObjective: true,
                startedAt: true,
                completedAt: true,
            },
        });

        if (!run) {
            return new Response(JSON.stringify({ error: "Solver run not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                const emitFromRun = (row: typeof run) => {
                    const status = row.status ?? "PENDING";
                    const terminal =
                        status === "COMPLETED" ||
                        status === "FAILED" ||
                        status === "STOPPED" ||
                        status === "COMPLETED_PARTIAL";

                    const elapsedMs = row.startedAt
                        ? ((row.completedAt ?? new Date()).getTime() - row.startedAt.getTime())
                        : 0;

                    const payload = {
                        status,
                        phase: row.phase ?? "CONSTRUCTION",
                        iteration: row.iterations ?? 0,
                        totalExams: row.totalExams ?? 0,
                        assignedExams: row.assignedExams ?? 0,
                        directConflicts: row.directConflicts ?? 0,
                        backToBackConflicts: row.backToBackConflicts ?? 0,
                        moreThan2ADay: row.moreThan2ADay ?? 0,
                        totalPenalty: row.totalPenalty ?? 0,
                        bestObjective: row.bestObjective ?? 0,
                        timeElapsedMs: elapsedMs,
                    };

                    if (!row.startedAt || (row.iterations ?? 0) === 0) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "INITIALIZING" })}\n\n`));
                        return terminal;
                    }

                    if (terminal) {
                        const type = status === "FAILED" ? "ERROR" : "COMPLETE";
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...payload })}\n\n`));
                    } else {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
                    }

                    return terminal;
                };

                let closed = false;
                let tick: ReturnType<typeof setInterval> | null = null;
                const closeStream = () => {
                    if (closed) return;
                    closed = true;
                    if (tick) clearInterval(tick);
                    controller.close();
                };

                // Emit immediately
                if (emitFromRun(run)) {
                    closeStream();
                    return;
                }

                tick = setInterval(async () => {
                    try {
                        const fresh = await prisma.solverRun.findUnique({
                            where: { id },
                            select: {
                                id: true,
                                status: true,
                                phase: true,
                                iterations: true,
                                totalExams: true,
                                assignedExams: true,
                                directConflicts: true,
                                backToBackConflicts: true,
                                moreThan2ADay: true,
                                totalPenalty: true,
                                bestObjective: true,
                                startedAt: true,
                                completedAt: true,
                            },
                        });

                        if (!fresh) {
                            closeStream();
                            return;
                        }

                        if (emitFromRun(fresh)) {
                            closeStream();
                        }
                    } catch {
                        closeStream();
                    }
                }, 1000);

                req.signal.addEventListener("abort", () => {
                    closeStream();
                });
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    }

    // Set up SSE stream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Send initial state
            if (state.latestProgress) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(state.latestProgress)}\n\n`));
            } else {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "INITIALIZING" })}\n\n`));
            }

            // Event listeners for progress
            const onProgress = (e: Event) => {
                const customEvent = e as CustomEvent;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(customEvent.detail)}\n\n`));
            };

            const onDone = (e: Event) => {
                const customEvent = e as CustomEvent;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'COMPLETE', ...customEvent.detail })}\n\n`));
                controller.close();
            };

            const onError = (e: Event) => {
                const customEvent = e as CustomEvent;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ERROR', message: customEvent.detail?.message })}\n\n`));
                controller.close();
            };

            state.emitter.addEventListener("progress", onProgress);
            state.emitter.addEventListener("done", onDone);
            state.emitter.addEventListener("error", onError);

            // Handle client disconnect
            req.signal.addEventListener("abort", () => {
                state.emitter.removeEventListener("progress", onProgress);
                state.emitter.removeEventListener("done", onDone);
                state.emitter.removeEventListener("error", onError);
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
