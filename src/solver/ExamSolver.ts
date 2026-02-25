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
import { type ExamNeighbour, ExamSimpleNeighbour } from "./neighbours/ExamNeighbour";
import {
    generateRandomMove,
    generateTimeMove,
    generateRoomMove,
    generatePeriodSwapMove
} from "./neighbours/ExamMoves";
import { SolverPhase, SolverStatus, type SolverProgress, type SolverConfiguration } from "./types";

export type SolverProgressCallback = (progress: SolverProgress) => void;

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
}

export class ExamSolver {
    private model: ExamModel;
    private config: SolverConfiguration;
    private status: SolverStatus = SolverStatus.IDLE;
    private phase: SolverPhase = SolverPhase.CONSTRUCTION;
    private iteration: number = 0;
    private startTime: number = 0;
    private bestObjective: number = Infinity;
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
        console.log("[Solver] Phase 1: Construction");

        // Sort exams by priority (largest/most constrained first)
        const examOrder = [...this.model.exams].sort((a, b) => a.comparePriority(b));

        for (const exam of examOrder) {
            if (this.shouldStop) return;

            const bestPlacement = this.findBestPlacement(exam);
            if (bestPlacement) {
                this.model.assignExam(exam, bestPlacement);
            }

            this.iteration++;
            if (this.iteration % 10 === 0) {
                this.saveBestIfImproved();
                this.emitProgress();
                await this.yieldControl();
            }
        }

        this.saveBestIfImproved();
        this.emitProgress();
        console.log(`[Solver] Construction complete: ${this.model.nrAssigned}/${this.model.exams.length} assigned`);
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
     * Check if a period is feasible for an exam (hard constraints only).
     */
    private isPeriodFeasible(exam: Exam, pp: ExamPeriodPlacement): boolean {
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
                if (!dc.isPeriodSatisfied(p1, p2)) return false;
            }
        }

        // Check student availability
        for (const student of exam.students) {
            if (!student.isAvailable(pp.period)) return false;
        }

        // Check instructor availability
        for (const instructor of exam.instructors) {
            if (!instructor.isAvailable(pp.period)) return false;
        }

        return true;
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
                    cost += 100000; // Large penalty for hard constraint violation
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

        console.log(`[Solver] Great Deluge complete at iteration ${this.iteration}`);
    }

    // ===================== PHASE 4: FINALIZATION =====================

    private async runFinalization(): Promise<void> {
        this.phase = SolverPhase.FINALIZATION;
        console.log("[Solver] Phase 4: Finalization");

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
        if (obj < this.bestObjective) {
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
        };
    }
}
