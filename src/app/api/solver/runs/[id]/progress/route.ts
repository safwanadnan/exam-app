/**
 * GET /api/solver/runs/[id]/progress — Server-Sent Events (SSE) for live solver progress
 */
import { NextRequest } from "next/server";
import { activeSolvers } from "@/lib/solver-manager";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: RouteContext) {
    const { id } = await ctx.params;
    const state = activeSolvers.get(id);

    if (!state) {
        return new Response(JSON.stringify({ error: "Solver run not found or not active" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
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
