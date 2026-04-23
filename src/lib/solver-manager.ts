/**
 * SolverManager - Maintains active solver instances across API requests.
 * Since Next.js reloads modules in dev, we use `globalThis` to preserve state.
 */
import { ExamSolver, loadExamModel, saveExamResults, type SolverProgress, ExamModel } from "@/solver";
import { ExamPlacement, ExamPeriodPlacement, ExamRoomPlacement } from "@/solver/model/ExamPlacement";
import { prisma } from "./prisma";
import { recomputeSectionGroups } from "./section-groups";

// Use global.EventTarget if available, or fallback
// We'll use a basic EventTarget to emit progress events for SSE.
class SolverEventEmitter extends EventTarget { }

type SolverState = {
    solver: ExamSolver;
    emitter: SolverEventEmitter;
    latestProgress: SolverProgress | null;
};

const globalForManager = globalThis as unknown as {
    activeSolvers: Map<string, SolverState> | undefined;
};

export const activeSolvers = globalForManager.activeSolvers ?? new Map<string, SolverState>();

if (process.env.NODE_ENV !== "production") {
    globalForManager.activeSolvers = activeSolvers;
}

/**
 * Load warm start assignments from a previous solver run and apply them to the model.
 * Handles cases where:
 * - Periods/rooms may have been deleted or modified
 * - Constraints have changed
 * - Only valid assignments are applied (others are skipped)
 */
async function applyWarmStartAssignments(model: ExamModel, warmStartRunId: string): Promise<number> {
    try {
        // Load assignments from the previous run
        const prevAssignments = await prisma.examAssignment.findMany({
            where: { runId: warmStartRunId },
            include: {
                exam: true,
                period: true,
                rooms: { include: { room: true } },
            },
        });

        let appliedCount = 0;
        let skippedCount = 0;

        for (const assignment of prevAssignments) {
            // Verify exam still exists in current model
            const exam = model.getExam(assignment.examId);
            if (!exam) {
                skippedCount++;
                continue;
            }

            // Verify period still exists in current model
            const period = model.getPeriod(assignment.periodId);
            if (!period) {
                skippedCount++;
                continue;
            }

            // Verify all rooms still exist and are available
            const roomIds = assignment.rooms.map(r => r.roomId);
            const validRooms: any[] = [];
            for (const roomId of roomIds) {
                const room = model.getRoom(roomId);
                if (room && room.isAvailable(period)) {
                    validRooms.push(room);
                }
            }

            // If no valid rooms found but exam needs rooms, skip
            if (exam.maxRooms > 0 && validRooms.length === 0) {
                skippedCount++;
                continue;
            }

            // Create placement with valid rooms or empty if no rooms needed
            const roomPlacements = validRooms.map(room => new ExamRoomPlacement(room, 0));
            const periodPlacement = new ExamPeriodPlacement(period, 0);
            const placement = new ExamPlacement(periodPlacement, roomPlacements);

            // Apply assignment to model
            try {
                model.assignExam(exam, placement);
                appliedCount++;
            } catch (e) {
                console.warn(`[WarmStart] Failed to assign exam ${exam.id}:`, e);
                skippedCount++;
            }
        }

        console.log(
            `[WarmStart] Applied ${appliedCount} assignments from previous run, skipped ${skippedCount}`
        );
        return appliedCount;
    } catch (e) {
        console.error("[WarmStart] Error loading warm start assignments:", e);
        return 0;
    }
}

/**
 * Starts a solver run asynchronously.
 */
export async function startSolverRun(
    runId: string,
    sessionId: string,
    configId: string,
    warmStartRunId?: string
) {
    if (activeSolvers.has(runId)) {
        throw new Error("Solver run already in progress");
    }

    // Update run status
    await prisma.solverRun.update({
        where: { id: runId },
        data: { status: "RUNNING", startedAt: new Date() },
    });

    // Keep section-group constraints aligned with latest imported data before loading the model.
    await recomputeSectionGroups(prisma, sessionId);

    // Load the model
    const model = await loadExamModel(prisma, sessionId, configId);

    // If warm start is requested, load and apply previous assignments
    if (warmStartRunId) {
        await applyWarmStartAssignments(model, warmStartRunId);
    }

    const solver = new ExamSolver(model);
    const emitter = new SolverEventEmitter();

    const state: SolverState = {
        solver,
        emitter,
        latestProgress: null,
    };
    activeSolvers.set(runId, state);

    let lastPersistedAt = 0;
    let persistInFlight = false;

    // Set up progress reporting
    solver.setProgressCallback((progress) => {
        state.latestProgress = progress;
        // Emit custom event
        const event = new CustomEvent("progress", { detail: progress });
        emitter.dispatchEvent(event);

        // Persist snapshots periodically so other worker processes can stream progress.
        const now = Date.now();
        if (persistInFlight || now - lastPersistedAt < 1500) return;

        lastPersistedAt = now;
        persistInFlight = true;

        prisma.solverRun.update({
            where: { id: runId },
            data: {
                status: "RUNNING",
                phase: progress.phase,
                iterations: progress.iteration,
                totalExams: progress.totalExams,
                assignedExams: progress.assignedExams,
                directConflicts: progress.directConflicts,
                backToBackConflicts: progress.backToBackConflicts,
                moreThan2ADay: progress.moreThan2ADay,
                totalPenalty: progress.totalPenalty,
                bestObjective: progress.bestObjective,
            },
        }).catch((e) => {
            console.error("[SolverManager] Failed to persist progress snapshot:", e);
        }).finally(() => {
            persistInFlight = false;
        });
    });

    // Run the solver in the background
    // We don't await this so the API can return immediately
    solver.solve().then(async (result) => {
        try {
            // Save results
            await saveExamResults(prisma, model, runId);

            // Update run status in DB
            await prisma.solverRun.update({
                where: { id: runId },
                data: {
                    status: result.status,
                    completedAt: new Date(),
                    totalExams: result.totalExams,
                    assignedExams: result.assignedExams,
                    directConflicts: result.directConflicts,
                    backToBackConflicts: result.backToBackConflicts,
                    moreThan2ADay: result.moreThan2ADay,
                    totalPenalty: result.totalPenalty,
                    iterations: result.iterations,
                    log: JSON.stringify(result.diagnostics),
                }
            });

            // Emit final event
            emitter.dispatchEvent(new CustomEvent("done", { detail: result }));
        } catch (e) {
            console.error("[SolverManager] Error saving results:", e);
            await prisma.solverRun.update({
                where: { id: runId },
                data: { status: "FAILED" },
            });
            emitter.dispatchEvent(new CustomEvent("error", { detail: e }));
        } finally {
            // Cleanup after a delay to allow SSE clients to receive the final message
            setTimeout(() => {
                activeSolvers.delete(runId);
            }, 5000);
        }
    }).catch(async (e) => {
        console.error("[SolverManager] Solver exception:", e);
        await prisma.solverRun.update({
            where: { id: runId },
            data: { status: "FAILED" },
        });
        emitter.dispatchEvent(new CustomEvent("error", { detail: e }));
        activeSolvers.delete(runId);
    });

    return state;
}

export function stopSolverRun(runId: string) {
    const state = activeSolvers.get(runId);
    if (state) {
        state.solver.stop();
        return true;
    }
    return false;
}

export function getActiveSolver(runId: string) {
    return activeSolvers.get(runId);
}
