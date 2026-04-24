/**
 * ExamSolver - The main solver orchestrator.
 * Maps to CPSolver's ExamNeighbourSelection.java + Solver framework.
 * 
 * Implements the complete 5-phase pipeline from UniTime:
 * 1. Construction Phase - assign all exams using greedy heuristic
 * 2. Hill Climbing - local optimization (accept only improvements)
 * 3. Simulated Annealing OR Great Deluge - global optimization
 * 4. Finalization - final hill climbing sweep
 * 
 * The solver runs asynchronously and emits progress events.
 */
import { ExamModel, Exam, ExamPlacement, ExamPeriodPlacement } from "./model";
import { type ExamNeighbour } from "./neighbours/ExamNeighbour";
import {
    generateRandomMove,
    generateTimeMove,
    generateRoomMove,
    generatePeriodSwapMove
} from "./neighbours/ExamMoves";
import { SolverPhase, SolverStatus, type SolverProgress, type SolverConfiguration } from "./types";

export type SolverProgressCallback = (progress: SolverProgress) => void;

// ===================== DIAGNOSTICS =====================

export type FailureReason =
    | "NO_PERIODS_IN_DOMAIN"
    | "ALL_PERIODS_INFEASIBLE"
    | "NO_ROOMS_AVAILABLE"
    | "STUDENT_UNAVAILABILITY"
    | "INSTRUCTOR_UNAVAILABILITY"
    | "HARD_DISTRIBUTION_CONSTRAINT"
    | "INSUFFICIENT_ROOM_CAPACITY";

export interface ExamDiagnostic {
    examId: string;
    examName: string;
    examSize: number;
    assigned: boolean;
    failureReasons: FailureReason[];
    details: string[];
    distributionViolations: string[]; // New: track violated distribution constraints
    periodsTried: number;
    periodsInDomain: number;
    periodRejections: {
        studentConflicts: number;
        instructorConflicts: number;
        hardConstraints: number;
        noRooms: number;
    };
}

export interface PhaseSummary {
    phase: string;
    startIteration: number;
    endIteration: number;
    startObjective: number;
    endObjective: number;
    durationMs: number;
    movesAccepted: number;
    movesRejected: number;
}

export interface SolverDiagnostics {
    examDiagnostics: ExamDiagnostic[];
    phaseSummaries: PhaseSummary[];
    unassignedCount: number;
    assignedCount: number;
    totalCount: number;
    topIssues: string[];
}

export interface SolverResult {
    status: SolverStatus;
    totalExams: number;
    assignedExams: number;
    directConflicts: number;
    backToBackConflicts: number;
    moreThan2ADay: number;
    totalPenalty: number;
    iterations: number;
    timeMs: number;
    diagnostics: SolverDiagnostics;
}

export class ExamSolver {
    private model: ExamModel;
    private config: SolverConfiguration;
    private status: SolverStatus = SolverStatus.IDLE;
    private phase: SolverPhase = SolverPhase.CONSTRUCTION;
    private iteration: number = 0;
    private startTime: number = 0;
    private bestObjective: number = Infinity;
    private bestAssignedCount: number = 0;
    private bestAssignments: Map<string, ExamPlacement> = new Map();
    private shouldStop: boolean = false;
    private onProgress: SolverProgressCallback | null = null;

    // SA state
    private saTemperature: number = 0;
    private saLastImprovingIter: number = 0;
    private saLastCoolingIter: number = 0;
    private saLastReheatIter: number = 0;
    private saAccepted: number = 0;
    private saTotalMoves: number = 0;

    // GD state
    private gdBound: number = 0;

    // HC state
    private hcIdleIterations: number = 0;

    // Diagnostics
    private examDiagnostics: Map<string, ExamDiagnostic> = new Map();
    private phaseSummaries: PhaseSummary[] = [];
    private phaseMovesAccepted: number = 0;
    private phaseMovesRejected: number = 0;
    private phaseStartTime: number = 0;
    private phaseStartIteration: number = 0;
    private phaseStartObjective: number = 0;

    constructor(model: ExamModel) {
        this.model = model;
        this.config = model.config;
    }

    setProgressCallback(callback: SolverProgressCallback): void {
        this.onProgress = callback;
    }

    getStatus(): SolverStatus { return this.status; }
    getPhase(): SolverPhase { return this.phase; }

    /**
     * Stop the solver.
     */
    stop(): void {
        this.shouldStop = true;
    }

    /**
     * Run the complete solver pipeline.
     * This is an async generator that yields control periodically
     * to allow cancellation and progress reporting.
     */
    async solve(): Promise<SolverResult> {
        this.status = SolverStatus.RUNNING;
        this.startTime = Date.now();
        this.shouldStop = false;
        this.iteration = 0;
        this.bestObjective = Infinity;
        this.bestAssignedCount = 0;

        try {
            // PHASE 1: Construction
            await this.runConstruction();

            if (this.shouldStop) return this.buildResult(SolverStatus.STOPPED);

            // PHASE 2: Hill Climbing
            await this.runHillClimbing();

            if (this.shouldStop) return this.buildResult(SolverStatus.STOPPED);

            // PHASE 3: Simulated Annealing or Great Deluge
            if (this.config.useGreatDeluge) {
                await this.runGreatDeluge();
            } else {
                await this.runSimulatedAnnealing();
            }

            if (this.shouldStop) return this.buildResult(SolverStatus.STOPPED);

            // PHASE 4: Finalization (final HC sweep)
            await this.runFinalization();

            // Restore best solution
            this.restoreBest();

            return this.buildResult(SolverStatus.COMPLETED);
        } catch (error) {
            console.error("[Solver] Error:", error);
            return this.buildResult(SolverStatus.FAILED);
        }
    }

    // ===================== PHASE 1: CONSTRUCTION =====================

    /**
     * Construction phase: assign all exams using greedy heuristic.
     * Maps to ExamConstruction.selectNeighbour() in CPSolver.
     * 
     * Strategy: 
     * - Sort exams by priority (largest/most constrained first)
     * - For each exam, find the best period+room placement
     * - "Best" = lowest conflict cost
     */
    private async runConstruction(): Promise<void> {
        this.phase = SolverPhase.CONSTRUCTION;
        this.beginPhaseTracking();
        console.log("[Solver] Phase 1: Construction");

        // Sort exams by priority (largest/most constrained first)
        const examOrder = [...this.model.exams].sort((a, b) => a.comparePriority(b));

        for (const exam of examOrder) {
            if (this.shouldStop) return;

            const diagnostic = this.diagnoseAndPlace(exam);
            this.examDiagnostics.set(exam.id, diagnostic);

            if (diagnostic.assigned) {
                this.phaseMovesAccepted++;
            } else {
                this.phaseMovesRejected++;
            }

            this.iteration++;
            if (this.iteration % 10 === 0) {
                this.saveBestIfImproved();
                this.emitProgress();
                await this.yieldControl();
            }
        }

        this.saveBestIfImproved();
        this.endPhaseTracking("Construction");
        this.emitProgress();
        console.log(`[Solver] Construction complete: ${this.model.nrAssigned}/${this.model.exams.length} assigned`);

        // Log unassigned exam reasons
        const unassigned = [...this.examDiagnostics.values()].filter(d => !d.assigned);
        if (unassigned.length > 0) {
            console.log(`[Solver] ${unassigned.length} exams could not be assigned:`);
            for (const d of unassigned.slice(0, 20)) {
                console.log(`  - ${d.examName} (${d.examSize} students): ${d.details.join("; ")}`);
            }
            if (unassigned.length > 20) console.log(`  ... and ${unassigned.length - 20} more`);
        }
    }

    /**
     * Diagnose an exam's placement attempt and place it if possible.
     * Returns detailed diagnostic information about what happened.
     */
    private diagnoseAndPlace(exam: Exam): ExamDiagnostic {
        const diag: ExamDiagnostic = {
            examId: exam.id,
            examName: exam.name,
            examSize: exam.size,
            assigned: false,
            failureReasons: [],
            details: [],
            periodsTried: 0,
            periodsInDomain: exam.periodPlacements.length,
            periodRejections: {
                studentConflicts: 0,
                instructorConflicts: 0,
                hardConstraints: 0,
                noRooms: 0,
            },
        };

        if (exam.periodPlacements.length === 0) {
            diag.failureReasons.push("NO_PERIODS_IN_DOMAIN");
            diag.details.push("No periods available in domain (all prohibited or wrong exam type)");
            return diag;
        }

        let bestPlacement: ExamPlacement | null = null;
        let bestCost = Infinity;

        for (const pp of exam.periodPlacements) {
            diag.periodsTried++;

            // Check hard constraints for this period (with detailed reasons)
            const feasibility = this.checkPeriodFeasibility(exam, pp);
            if (!feasibility.feasible) {
                if (feasibility.reason === "STUDENT_UNAVAILABILITY") diag.periodRejections.studentConflicts++;
                else if (feasibility.reason === "INSTRUCTOR_UNAVAILABILITY") diag.periodRejections.instructorConflicts++;
                else if (feasibility.reason === "HARD_DISTRIBUTION_CONSTRAINT") diag.periodRejections.hardConstraints++;
                continue;
            }

            // Find best rooms for this period
            const assignedRooms = this.model.getAssignedRoomsInPeriod(pp.period.id);
            const roomMap = new Map<string, Set<string>>();
            roomMap.set(pp.period.id, assignedRooms);
            const rooms = exam.findBestAvailableRooms(pp.period, roomMap);

            if (rooms === null && exam.maxRooms > 0) {
                diag.periodRejections.noRooms++;
                continue;
            }

            const placement = new ExamPlacement(pp, rooms ?? []);
            const cost = this.computePlacementCost(exam, placement);
            if (cost < bestCost) {
                bestCost = cost;
                bestPlacement = placement;
            }
        }

        if (bestPlacement) {
            this.model.assignExam(exam, bestPlacement);
            diag.assigned = true;
        } else {
            // Determine the primary failure reasons
            const rej = diag.periodRejections;
            if (rej.studentConflicts > 0 && rej.studentConflicts === diag.periodsTried) {
                diag.failureReasons.push("STUDENT_UNAVAILABILITY");
                diag.details.push(`All ${diag.periodsTried} periods rejected: students unavailable`);
            }
            if (rej.instructorConflicts > 0) {
                diag.failureReasons.push("INSTRUCTOR_UNAVAILABILITY");
                diag.details.push(`${rej.instructorConflicts} periods rejected: instructor unavailable`);
            }
            if (rej.hardConstraints > 0) {
                diag.failureReasons.push("HARD_DISTRIBUTION_CONSTRAINT");
                diag.details.push(`${rej.hardConstraints} periods rejected: hard distribution constraint violated`);
            }
            if (rej.noRooms > 0) {
                diag.failureReasons.push("NO_ROOMS_AVAILABLE");
                diag.details.push(`${rej.noRooms} periods rejected: no rooms with sufficient capacity (need ${exam.size} seats${exam.altSeating ? ", alt seating" : ""})`);
            }
            if (diag.failureReasons.length === 0 && diag.periodsInDomain > 0) {
                diag.failureReasons.push("ALL_PERIODS_INFEASIBLE");
                diag.details.push(`All ${diag.periodsInDomain} periods in domain were infeasible (mixed reasons)`);
            }
            if (diag.details.length === 0) {
                diag.details.push("Unknown failure — no feasible placement found");
            }
        }

        return diag;
    }

    /**
     * Find the best feasible placement for an exam.
     * Tries all period+room combinations and picks the one with lowest cost.
     */
    private findBestPlacement(exam: Exam): ExamPlacement | null {
        let bestPlacement: ExamPlacement | null = null;
        let bestCost = Infinity;

        for (const pp of exam.periodPlacements) {
            // Check hard constraints for this period
            if (!this.isPeriodFeasible(exam, pp)) continue;

            // Find best rooms for this period
            const assignedRooms = this.model.getAssignedRoomsInPeriod(pp.period.id);
            const roomMap = new Map<string, Set<string>>();
            roomMap.set(pp.period.id, assignedRooms);
            const rooms = exam.findBestAvailableRooms(pp.period, roomMap);

            if (rooms === null && exam.maxRooms > 0) continue;

            const placement = new ExamPlacement(pp, rooms ?? []);

            // Compute cost of this placement
            const cost = this.computePlacementCost(exam, placement);
            if (cost < bestCost) {
                bestCost = cost;
                bestPlacement = placement;
            }
        }

        return bestPlacement;
    }

    /**
     * Check period feasibility with detailed reason for rejection.
     */
    private checkPeriodFeasibility(exam: Exam, pp: ExamPeriodPlacement): { feasible: boolean; reason?: FailureReason } {
        // Check distribution constraints
        for (const dc of exam.distributionConstraints) {
            if (!dc.hard) continue;
            const otherExamId = dc.examAId === exam.id ? dc.examBId : dc.examAId;
            const otherExam = this.model.getExam(otherExamId);
            if (!otherExam?.isAssigned) continue;
            if (dc.isPeriodRelated()) {
                const examIsA = dc.examAId === exam.id;
                const p1 = examIsA ? pp.period : otherExam.assignment!.period;
                const p2 = examIsA ? otherExam.assignment!.period : pp.period;
                if (!dc.isPeriodSatisfied(p1, p2)) return { feasible: false, reason: "HARD_DISTRIBUTION_CONSTRAINT" };
            }
        }
        for (const student of exam.students) {
            if (!student.isAvailable(pp.period)) return { feasible: false, reason: "STUDENT_UNAVAILABILITY" };
        }
        for (const instructor of exam.instructors) {
            if (!instructor.isAvailable(pp.period)) return { feasible: false, reason: "INSTRUCTOR_UNAVAILABILITY" };
        }
        return { feasible: true };
    }

    /**
     * Check if a period is feasible for an exam (hard constraints only).
     */
    private isPeriodFeasible(exam: Exam, pp: ExamPeriodPlacement): boolean {
        return this.checkPeriodFeasibility(exam, pp).feasible;
    }

    /**
     * Compute the weighted cost of placing an exam at a specific placement.
     * Lower is better.
     */
    private computePlacementCost(exam: Exam, placement: ExamPlacement): number {
        const cfg = this.config;
        let cost = 0;

        const period = placement.period;

        // Student direct conflicts
        for (const student of exam.students) {
            const existing = this.model.getStudentExamsInPeriod(student.id, period.id);
            if (existing.size > 0) cost += cfg.directConflictWeight;
        }

        // Student back-to-back conflicts
        for (const student of exam.students) {
            // Check previous period
            if (period.prev) {
                const prev = this.model.getStudentExamsInPeriod(student.id, period.prev.id);
                if (prev.size > 0) cost += cfg.backToBackConflictWeight;
            }
            // Check next period
            if (period.next) {
                const next = this.model.getStudentExamsInPeriod(student.id, period.next.id);
                if (next.size > 0) cost += cfg.backToBackConflictWeight;
            }
        }

        // Student more-than-2-a-day
        for (const student of exam.students) {
            let examsThisDay = 0;
            for (const p of this.model.getPeriodsOfDay(period.day)) {
                const exams = this.model.getStudentExamsInPeriod(student.id, p.id);
                examsThisDay += exams.size;
            }
            if (examsThisDay >= 2) cost += cfg.moreThan2ADayWeight;
        }

        // Period penalty
        cost += placement.periodPlacement.penalty * cfg.periodPenaltyWeight;
        cost += period.index * cfg.periodIndexWeight;

        // Room penalties
        for (const rp of placement.roomPlacements) {
            cost += rp.penalty * cfg.roomPenaltyWeight;
            cost += rp.room.getPeriodPenalty(period) * cfg.roomPenaltyWeight;
        }

        // Room size penalty
        const excess = placement.getTotalCapacity(exam.altSeating) - exam.size;
        if (excess > 0) cost += excess * cfg.roomSizePenaltyWeight;

        // Room split penalty
        if (placement.roomPlacements.length > 1) {
            cost += (placement.roomPlacements.length - 1) * cfg.roomSplitPenaltyWeight;
        }

        // Distribution constraint penalties
        for (const dc of exam.distributionConstraints) {
            const otherExamId = dc.examAId === exam.id ? dc.examBId : dc.examAId;
            const otherExam = this.model.getExam(otherExamId);
            if (!otherExam?.isAssigned) continue;

            const examIsA = dc.examAId === exam.id;
            const p1 = examIsA ? placement : otherExam.assignment!;
            const p2 = examIsA ? otherExam.assignment! : placement;

            if (!dc.isSatisfied(p1, p2)) {
                if (dc.hard) {
                    cost += 1000000; // Increased penalty for hard constraint violation
                } else {
                    cost += dc.weight * cfg.distributionWeight;
                }
            }
        }

        return cost;
    }

    // ===================== PHASE 2: HILL CLIMBING =====================

    /**
     * Hill Climbing: accept only improving moves.
     * Maps to HillClimber in CPSolver.
     */
    private async runHillClimbing(): Promise<void> {
        this.phase = SolverPhase.HILL_CLIMBING;
        this.hcIdleIterations = 0;
        this.beginPhaseTracking();
        console.log("[Solver] Phase 2: Hill Climbing");

        while (!this.shouldStop && !this.isTimedOut()) {
            if (this.hcIdleIterations >= this.config.hcMaxIdleIterations) break;

            const neighbour = this.generateNeighbour();
            if (!neighbour) {
                this.hcIdleIterations++;
                continue;
            }

            const value = neighbour.value(this.model);
            if (value < 0) {
                // Improvement - accept
                neighbour.apply(this.model);
                this.hcIdleIterations = 0;
                this.saveBestIfImproved();
            } else {
                this.hcIdleIterations++;
            }

            this.iteration++;
            if (this.iteration % 100 === 0) {
                this.emitProgress();
                await this.yieldControl();
            }
        }

        this.endPhaseTracking("Hill Climbing");
        console.log(`[Solver] Hill Climbing complete at iteration ${this.iteration}`);
    }

    // ===================== PHASE 3A: SIMULATED ANNEALING =====================

    /**
     * Simulated Annealing: accept worsening moves with decreasing probability.
     * Maps to ExamSimulatedAnnealing in CPSolver.
     */
    private async runSimulatedAnnealing(): Promise<void> {
        this.phase = SolverPhase.SIMULATED_ANNEALING;
        console.log("[Solver] Phase 3: Simulated Annealing");

        // Initialize temperature
        this.saTemperature = this.config.saInitialTemperature;
        this.saLastImprovingIter = this.iteration;
        this.saLastCoolingIter = this.iteration;
        this.saLastReheatIter = this.iteration;
        this.saAccepted = 0;
        this.saTotalMoves = 0;
        this.beginPhaseTracking();

        const coolingRate = this.config.saCoolingRate;
        const reheatLength = this.config.saReheatLength;
        let reheatRate = this.config.saReheatRate;
        if (reheatRate < 0) {
            reheatRate = Math.pow(1 / coolingRate, reheatLength * 1.7);
        }

        while (!this.shouldStop && !this.isTimedOut()) {
            const neighbour = this.generateNeighbour();
            if (!neighbour) {
                this.iteration++;
                continue;
            }

            const value = neighbour.value(this.model);
            this.saTotalMoves++;

            if (this.acceptSA(value)) {
                neighbour.apply(this.model);
                this.saAccepted++;

                if (value < 0) {
                    this.saLastImprovingIter = this.iteration;
                }
                this.saveBestIfImproved();
            }

            // Cooling/reheating schedule
            this.updateSATemperature(reheatRate, reheatLength);

            this.iteration++;
            if (this.iteration % 100 === 0) {
                this.emitProgress();
                await this.yieldControl();
            }
        }

        this.endPhaseTracking("Simulated Annealing");
        console.log(`[Solver] Simulated Annealing complete at iteration ${this.iteration}`);
    }

    private acceptSA(value: number): boolean {
        if (value <= 0) return true; // Always accept improvements
        // Acceptance probability: exp(-value / temperature)
        const prob = Math.exp(-value / this.saTemperature);
        return Math.random() < prob;
    }

    private updateSATemperature(reheatRate: number, reheatLength: number): void {
        const coolingRate = this.config.saCoolingRate;
        const iterSinceCooling = this.iteration - this.saLastCoolingIter;

        // Cool every N iterations (N proportional to problem size)
        const coolingInterval = Math.max(1, Math.floor(this.model.exams.length / 10));

        if (iterSinceCooling >= coolingInterval) {
            this.saTemperature *= coolingRate;
            this.saLastCoolingIter = this.iteration;
        }

        // Reheat if stuck for too long
        const iterSinceImproving = this.iteration - this.saLastImprovingIter;
        const reheatThreshold = Math.floor(
            reheatLength * this.model.exams.length * coolingInterval
        );

        if (iterSinceImproving > reheatThreshold && this.iteration > this.saLastReheatIter + reheatThreshold) {
            this.saTemperature *= reheatRate;
            this.saLastReheatIter = this.iteration;
            this.restoreBest(); // Restore best solution when reheating
        }
    }

    // ===================== PHASE 3B: GREAT DELUGE =====================

    /**
     * Great Deluge: accept moves if they keep solution below a bound.
     * Maps to ExamGreatDeluge in CPSolver.
     */
    private async runGreatDeluge(): Promise<void> {
        this.phase = SolverPhase.GREAT_DELUGE;
        console.log("[Solver] Phase 3: Great Deluge");
        this.beginPhaseTracking();

        const currentObj = this.model.getTotalObjective();
        this.gdBound = currentObj * 1.1; // Start with 10% above current

        while (!this.shouldStop && !this.isTimedOut()) {
            const neighbour = this.generateNeighbour();
            if (!neighbour) {
                this.iteration++;
                continue;
            }

            const oldObj = this.model.getTotalObjective();
            const delta = neighbour.value(this.model);
            const newObj = oldObj + delta;

            if (newObj <= this.gdBound) {
                neighbour.apply(this.model);
                this.saveBestIfImproved();
            }

            // Lower the bound
            this.gdBound *= this.config.gdCoolRate;

            this.iteration++;
            if (this.iteration % 100 === 0) {
                this.emitProgress();
                await this.yieldControl();
            }
        }

        this.endPhaseTracking("Great Deluge");
        console.log(`[Solver] Great Deluge complete at iteration ${this.iteration}`);
    }

    // ===================== PHASE 4: FINALIZATION =====================

    private async runFinalization(): Promise<void> {
        this.phase = SolverPhase.FINALIZATION;
        console.log("[Solver] Phase 4: Finalization");
        this.beginPhaseTracking();

        this.hcIdleIterations = 0;
        const maxIdle = this.config.hcMaxIdleIterations;

        while (!this.shouldStop && this.hcIdleIterations < maxIdle) {
            const neighbour = this.generateNeighbour();
            if (!neighbour) {
                this.hcIdleIterations++;
                continue;
            }

            const value = neighbour.value(this.model);
            if (value < 0) {
                neighbour.apply(this.model);
                this.hcIdleIterations = 0;
                this.saveBestIfImproved();
            } else {
                this.hcIdleIterations++;
            }

            this.iteration++;
            if (this.iteration % 100 === 0) {
                this.emitProgress();
                await this.yieldControl();
            }
        }

        this.endPhaseTracking("Finalization");
        console.log(`[Solver] Finalization complete at iteration ${this.iteration}`);
    }

    // ===================== HELPER METHODS =====================

    /**
     * Generate a random neighbour move.
     * Selects from 4 move types with equal probability.
     */
    private generateNeighbour(): ExamNeighbour | null {
        const r = Math.random();
        if (r < 0.25) return generateRandomMove(this.model);
        if (r < 0.50) return generateTimeMove(this.model);
        if (r < 0.75) return generateRoomMove(this.model);
        return generatePeriodSwapMove(this.model);
    }

    /** Check if timeout has been reached */
    private isTimedOut(): boolean {
        return (Date.now() - this.startTime) >= this.config.timeout * 1000;
    }

    /** Save current solution if it's the best so far */
    private saveBestIfImproved(): void {
        const obj = this.model.getTotalObjective();
        const assigned = this.model.nrAssigned;
        const better = assigned > this.bestAssignedCount || (assigned === this.bestAssignedCount && obj < this.bestObjective);

        if (better) {
            this.bestAssignedCount = assigned;
            this.bestObjective = obj;
            this.bestAssignments.clear();
            for (const exam of this.model.exams) {
                if (exam.isAssigned) {
                    this.bestAssignments.set(exam.id, exam.assignment!);
                }
            }
        }
    }

    /** Restore the best solution found */
    private restoreBest(): void {
        // Unassign all
        for (const exam of this.model.exams) {
            if (exam.isAssigned) {
                this.model.unassignExam(exam);
            }
        }
        // Restore best
        for (const [examId, placement] of this.bestAssignments) {
            const exam = this.model.getExam(examId);
            if (exam) {
                this.model.assignExam(exam, placement);
            }
        }
    }

    /** Emit progress update */
    private emitProgress(): void {
        if (!this.onProgress) return;

        this.onProgress({
            phase: this.phase,
            iteration: this.iteration,
            totalExams: this.model.exams.length,
            assignedExams: this.model.nrAssigned,
            directConflicts: this.model.countDirectConflicts(),
            backToBackConflicts: this.model.countBackToBackConflicts(),
            moreThan2ADay: this.model.countMoreThan2ADay(),
            totalPenalty: this.model.getTotalObjective(),
            bestObjective: this.bestObjective,
            temperature: this.phase === SolverPhase.SIMULATED_ANNEALING ? this.saTemperature : undefined,
            bound: this.phase === SolverPhase.GREAT_DELUGE ? this.gdBound : undefined,
            timeElapsedMs: Date.now() - this.startTime,
        });
    }

    /** Yield control to allow async operations */
    private yieldControl(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    // ===================== PHASE TRACKING =====================

    private beginPhaseTracking(): void {
        this.phaseStartTime = Date.now();
        this.phaseStartIteration = this.iteration;
        this.phaseStartObjective = this.model.getTotalObjective();
        this.phaseMovesAccepted = 0;
        this.phaseMovesRejected = 0;
    }

    private endPhaseTracking(phaseName: string): void {
        this.phaseSummaries.push({
            phase: phaseName,
            startIteration: this.phaseStartIteration,
            endIteration: this.iteration,
            startObjective: this.phaseStartObjective,
            endObjective: this.model.getTotalObjective(),
            durationMs: Date.now() - this.phaseStartTime,
            movesAccepted: this.phaseMovesAccepted,
            movesRejected: this.phaseMovesRejected,
        });
    }

    // ===================== DIAGNOSTICS BUILDER =====================

    private buildDiagnostics(): SolverDiagnostics {
        const examDiagnostics = this.model.exams.map((exam) => {
            const existing = this.examDiagnostics.get(exam.id);
            
            // Check for distribution violations if assigned
            const distributionViolations: string[] = [];
            if (exam.isAssigned && exam.assignment) {
                for (const dc of exam.distributionConstraints) {
                    const otherExamId = dc.examAId === exam.id ? dc.examBId : dc.examAId;
                    const otherExam = this.model.getExam(otherExamId);
                    if (otherExam?.isAssigned && otherExam.assignment) {
                        if (!dc.isSatisfied(exam.assignment, otherExam.assignment)) {
                            distributionViolations.push(
                                `${dc.type.replace(/_/g, " ")} with ${otherExam.name}`
                            );
                        }
                    }
                }
            }

            if (existing) {
                return {
                    ...existing,
                    assigned: exam.isAssigned,
                    distributionViolations,
                };
            }

            return {
                examId: exam.id,
                examName: exam.name,
                examSize: exam.size,
                assigned: exam.isAssigned,
                failureReasons: [],
                details: exam.isAssigned ? [] : ["Exam is unassigned in final solution"],
                distributionViolations,
                periodsTried: 0,
                periodsInDomain: exam.periodPlacements.length,
                periodRejections: {
                    studentConflicts: 0,
                    instructorConflicts: 0,
                    hardConstraints: 0,
                    noRooms: 0,
                },
            };
        });
        const unassigned = examDiagnostics.filter(d => !d.assigned);
        const assigned = examDiagnostics.filter(d => d.assigned);

        // Build top issues summary
        const topIssues: string[] = [];

        const noPeriods = unassigned.filter(d => d.failureReasons.includes("NO_PERIODS_IN_DOMAIN"));
        if (noPeriods.length > 0) {
            topIssues.push(`${noPeriods.length} exam(s) have no periods in their domain — check that exam types have periods assigned`);
        }

        const noRooms = unassigned.filter(d => d.failureReasons.includes("NO_ROOMS_AVAILABLE"));
        if (noRooms.length > 0) {
            const maxSize = Math.max(...noRooms.map(d => d.examSize));
            topIssues.push(`${noRooms.length} exam(s) couldn’t find rooms with enough capacity (largest: ${maxSize} seats needed)`);
        }

        const studentBlock = unassigned.filter(d => d.failureReasons.includes("STUDENT_UNAVAILABILITY"));
        if (studentBlock.length > 0) {
            topIssues.push(`${studentBlock.length} exam(s) blocked by student unavailability in all periods`);
        }

        const instrBlock = unassigned.filter(d => d.failureReasons.includes("INSTRUCTOR_UNAVAILABILITY"));
        if (instrBlock.length > 0) {
            topIssues.push(`${instrBlock.length} exam(s) blocked by instructor unavailability`);
        }

        const hardConst = unassigned.filter(d => d.failureReasons.includes("HARD_DISTRIBUTION_CONSTRAINT"));
        if (hardConst.length > 0) {
            topIssues.push(`${hardConst.length} exam(s) blocked by hard distribution constraints`);
        }

        if (unassigned.length === 0) {
            topIssues.push("All exams were successfully assigned!");
        } else {
            topIssues.push(`${unassigned.length} exam(s) remain unassigned in the final solution.`);
        }

        // Add optimization phase summaries
        for (const ps of this.phaseSummaries) {
            const improvement = ps.startObjective - ps.endObjective;
            if (ps.phase !== "Construction" && improvement > 0) {
                topIssues.push(`${ps.phase}: reduced penalty by ${Math.round(improvement)} (${ps.movesAccepted} moves accepted in ${(ps.durationMs / 1000).toFixed(1)}s)`);
            }
        }

        return {
            examDiagnostics,
            phaseSummaries: this.phaseSummaries,
            unassignedCount: unassigned.length,
            assignedCount: assigned.length,
            totalCount: examDiagnostics.length,
            topIssues,
        };
    }

    private buildResult(status: SolverStatus): SolverResult {
        this.status = status;
        return {
            status,
            totalExams: this.model.exams.length,
            assignedExams: this.model.nrAssigned,
            directConflicts: this.model.countDirectConflicts(),
            backToBackConflicts: this.model.countBackToBackConflicts(),
            moreThan2ADay: this.model.countMoreThan2ADay(),
            totalPenalty: this.model.getTotalObjective(),
            iterations: this.iteration,
            timeMs: Date.now() - this.startTime,
            diagnostics: this.buildDiagnostics(),
        };
    }
}
