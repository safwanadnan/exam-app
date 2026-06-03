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
import { buildSameTimeGroups } from "./model/ExamSameTimePeer";
import { ExamChainNeighbour, type ExamNeighbour } from "./neighbours/ExamNeighbour";
import {
    generateRandomMove,
    generateTimeMove,
    generateRoomMove,
    generatePeriodSwapMove,
    generateConflictMove,
    generateKempeChainMove
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

    // Same-time peer groups: examId → all exams that must share the same period
    private sameTimeGroups: Map<string, Exam[]> = new Map();
    // Set of exam IDs already handled as part of a group (to avoid double-placing)
    private placedAsGroup: Set<string> = new Set();

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

        // Build same-time peer groups ONCE before construction.
        // Exams linked by hard SAME_PERIOD must be placed atomically.
        this.sameTimeGroups = buildSameTimeGroups(this.model);
        this.placedAsGroup = new Set();

        const nGroups = new Set(Array.from(this.sameTimeGroups.values()).map(g => g.map(e => e.id).sort().join(","))).size;
        console.log(`[Solver] Built ${nGroups} same-time groups from SAME_PERIOD hard constraints`);

        // Sort exams by priority (largest/most constrained first)
        const examOrder = [...this.model.exams].sort((a, b) => a.comparePriority(b));

        for (const exam of examOrder) {
            if (this.shouldStop) return;

            // Skip exams already assigned as part of a group
            if (this.placedAsGroup.has(exam.id)) continue;

            const group = this.sameTimeGroups.get(exam.id) ?? [exam];

            if (group.length > 1) {
                // --- Atomic group placement ---
                const placed = this.diagnoseAndPlaceGroup(group);
                for (const [e, diag] of placed) {
                    this.examDiagnostics.set(e.id, diag);
                    this.placedAsGroup.add(e.id);
                    if (diag.assigned) this.phaseMovesAccepted++;
                    else this.phaseMovesRejected++;
                }
            } else {
                // --- Single exam placement ---
                const diagnostic = this.diagnoseAndPlace(exam);
                this.examDiagnostics.set(exam.id, diagnostic);
                this.placedAsGroup.add(exam.id);
                if (diagnostic.assigned) this.phaseMovesAccepted++;
                else this.phaseMovesRejected++;
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
        const unassigned = Array.from(this.examDiagnostics.values()).filter(d => !d.assigned);
        if (unassigned.length > 0) {
            console.log(`[Solver] ${unassigned.length} exams could not be assigned:`);
            for (const d of unassigned.slice(0, 20)) {
                console.log(`  - ${d.examName} (${d.examSize} students): ${d.details.join("; ")}`);
            }
            if (unassigned.length > 20) console.log(`  ... and ${unassigned.length - 20} more`);
        }
    }

    /**
     * Place an entire same-time group atomically.
     * Finds the single best period that works for ALL exams in the group,
     * then assigns each exam to that period.
     */
    private diagnoseAndPlaceGroup(group: Exam[]): Array<[Exam, ExamDiagnostic]> {
        // Find the intersection of period domains across all exams
        // (only periods that appear in every exam's domain are valid)
        const periodSets = group.map(e => new Set(e.periodPlacements.map(pp => pp.period.id)));
        const commonPeriodIds = periodSets.reduce((acc, s) => {
            const result = new Set<string>();
            for (const id of acc) if (s.has(id)) result.add(id);
            return result;
        });

        // Evaluate every common period and pick the one with lowest total group cost
        let bestPeriodId: string | null = null;
        let bestCost = Infinity;

        for (const periodId of Array.from(commonPeriodIds)) {
            // All exams must be feasible in this period
            let feasible = true;
            for (const e of group) {
                // Temporarily skip other group members when checking feasibility
                // (they won't be assigned yet, so SAME_PERIOD constraints won't fire)
                if (!this.isPeriodFeasibleIgnoringGroup(e, e.periodPlacements.find(pp => pp.period.id === periodId)!, group)) {
                    feasible = false;
                    break;
                }
            }
            if (!feasible) continue;

            // All exams must have rooms in this period
            let totalCost = 0;
            let allHaveRooms = true;

            // Simulate sequential room assignment within the period for the group
            const simulatedOccupied = new Set<string>(this.model.getAssignedRoomsInPeriod(periodId));

            for (const e of group) {
                const pp = e.periodPlacements.find(p => p.period.id === periodId)!;
                const roomMap = new Map<string, Set<string>>();
                roomMap.set(periodId, new Set(simulatedOccupied));
                const rooms = e.findBestAvailableRooms(pp.period, roomMap);
                if (rooms === null && e.maxRooms > 0) { allHaveRooms = false; break; }
                if (rooms) for (const rp of rooms) simulatedOccupied.add(rp.room.id);

                const placement = new ExamPlacement(pp, rooms ?? []);
                totalCost += this.computePlacementCost(e, placement);
            }
            if (!allHaveRooms) continue;

            if (totalCost < bestCost) {
                bestCost = totalCost;
                bestPeriodId = periodId;
            }
        }

        const results: Array<[Exam, ExamDiagnostic]> = [];

        if (bestPeriodId === null) {
            // Could not place the group together — leave all unassigned with a diagnostic
            for (const e of group) {
                results.push([e, {
                    examId: e.id,
                    examName: e.name,
                    examSize: e.size,
                    assigned: false,
                    failureReasons: ["HARD_DISTRIBUTION_CONSTRAINT"],
                    details: [`No common feasible period found for SAME_PERIOD group of ${group.length} exams`],
                    distributionViolations: [],
                    periodsTried: commonPeriodIds.size,
                    periodsInDomain: e.periodPlacements.length,
                    periodRejections: { studentConflicts: 0, instructorConflicts: 0, hardConstraints: group.length, noRooms: 0 },
                }]);
            }
            return results;
        }

        // Assign the whole group to the chosen period
        const occupied = new Set<string>(this.model.getAssignedRoomsInPeriod(bestPeriodId));
        for (const e of group) {
            const pp = e.periodPlacements.find(p => p.period.id === bestPeriodId)!;
            const roomMap = new Map<string, Set<string>>();
            roomMap.set(bestPeriodId, new Set(occupied));
            const rooms = e.findBestAvailableRooms(pp.period, roomMap);
            if (rooms) for (const rp of rooms) occupied.add(rp.room.id);

            const placement = new ExamPlacement(pp, rooms ?? []);
            this.model.assignExam(e, placement);

            results.push([e, {
                examId: e.id,
                examName: e.name,
                examSize: e.size,
                assigned: true,
                failureReasons: [],
                details: [`Placed as part of SAME_PERIOD group in period ${bestPeriodId}`],
                distributionViolations: [],
                periodsTried: commonPeriodIds.size,
                periodsInDomain: e.periodPlacements.length,
                periodRejections: { studentConflicts: 0, instructorConflicts: 0, hardConstraints: 0, noRooms: 0 },
            }]);
        }
        return results;
    }

    /**
     * Check period feasibility for an exam while ignoring not-yet-assigned group members.
     * Used during group construction so intra-group SAME_PERIOD constraints don't self-block.
     */
    private isPeriodFeasibleIgnoringGroup(exam: Exam, pp: ExamPeriodPlacement, group: Exam[]): boolean {
        const groupIds = new Set(group.map(e => e.id));
        for (const dc of exam.distributionConstraints) {
            if (!dc.hard) continue;
            const otherExamId = dc.examAId === exam.id ? dc.examBId : dc.examAId;
            // Skip intra-group constraints; they're satisfied by definition (we're placing all together)
            if (groupIds.has(otherExamId)) continue;
            const otherExam = this.model.getExam(otherExamId);
            if (!otherExam?.isAssigned) continue;
            if (dc.isPeriodRelated()) {
                const examIsA = dc.examAId === exam.id;
                const p1 = examIsA ? pp.period : otherExam.assignment!.period;
                const p2 = examIsA ? otherExam.assignment!.period : pp.period;
                if (!dc.isPeriodSatisfied(p1, p2)) return false;
            }
        }
        for (const student of exam.students) {
            if (!student.isAvailable(pp.period)) return false;
        }
        for (const instructor of exam.instructors) {
            if (!instructor.isAvailable(pp.period)) return false;
        }
        return true;
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
            distributionViolations: [],
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

        // Attempt backtracking if the best placement still has direct conflicts
        if (bestPlacement && bestCost >= this.config.directConflictWeight) {
            const backtrackResult = this.attemptConstructionBacktrack(exam);
            if (backtrackResult) {
                bestPlacement = backtrackResult.placement;
                bestCost = backtrackResult.cost;
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
     * Try to move a single conflicting exam to find a clean placement for this exam.
     */
    private attemptConstructionBacktrack(exam: Exam): { placement: ExamPlacement, cost: number } | null {
        // Try each period
        for (const pp of exam.periodPlacements) {
            if (!this.model.isPeriodFeasible(exam, pp.period.id)) continue;
            
            // Find exams that cause direct conflicts in this period
            const conflictingExams = new Set<Exam>();
            for (const student of exam.students) {
                for (const ce of Array.from(this.model.getStudentExamsInPeriod(student.id, pp.period.id))) {
                    conflictingExams.add(ce);
                }
            }
            for (const instructor of exam.instructors) {
                for (const ce of Array.from(this.model.getInstructorExamsInPeriod(instructor.id, pp.period.id))) {
                    conflictingExams.add(ce);
                }
            }

            // If there's exactly ONE conflicting exam, try moving it
            if (conflictingExams.size === 1) {
                const confExam = Array.from(conflictingExams)[0];
                const oldPlacement = confExam.assignment!;
                
                this.model.unassignExam(confExam);
                
                // See if we can place confExam somewhere else with 0 conflicts
                const newConfPlacement = this.findBestPlacement(confExam);
                if (newConfPlacement && this.computePlacementCost(confExam, newConfPlacement) < this.config.directConflictWeight) {
                    // Success! We found a clean spot for confExam.
                    this.model.assignExam(confExam, newConfPlacement);
                    
                    // Now place our original exam in this period
                    const assignedRooms = this.model.getAssignedRoomsInPeriod(pp.period.id);
                    const roomMap = new Map<string, Set<string>>();
                    roomMap.set(pp.period.id, assignedRooms);
                    const rooms = exam.findBestAvailableRooms(pp.period, roomMap);
                    
                    if (rooms) {
                        const placement = new ExamPlacement(pp, rooms);
                        const cost = this.computePlacementCost(exam, placement);
                        if (cost < this.config.directConflictWeight) {
                            return { placement, cost };
                        }
                    }
                    
                    // If it still didn't work out cleanly, revert
                    this.model.unassignExam(confExam);
                }
                
                // Revert
                this.model.assignExam(confExam, oldPlacement);
            }
        }
        return null;
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

        // Instructor direct conflicts
        for (const instructor of exam.instructors) {
            const existing = this.model.getInstructorExamsInPeriod(instructor.id, period.id);
            if (existing.size > 0) cost += cfg.instructorDirectConflictWeight;
        }

        // Instructor back-to-back
        for (const instructor of exam.instructors) {
            if (period.prev) {
                const prev = this.model.getInstructorExamsInPeriod(instructor.id, period.prev.id);
                if (prev.size > 0) cost += cfg.instructorBackToBackConflictWeight;
            }
            if (period.next) {
                const next = this.model.getInstructorExamsInPeriod(instructor.id, period.next.id);
                if (next.size > 0) cost += cfg.instructorBackToBackConflictWeight;
            }
        }

        // Instructor more-than-2-a-day
        for (const instructor of exam.instructors) {
            let examsThisDay = 0;
            for (const p of this.model.getPeriodsOfDay(period.day)) {
                const exams = this.model.getInstructorExamsInPeriod(instructor.id, p.id);
                examsThisDay += exams.size;
            }
            if (examsThisDay >= 2) cost += cfg.instructorMoreThan2ADayWeight;
        }

        // Period penalty
        cost += placement.periodPlacement.penalty * cfg.periodPenaltyWeight;
        cost += period.index * cfg.periodIndexWeight;

        // Period density penalty: penalize using the same period for many exams
        if (cfg.periodSizeWeight > 0) {
            const examsInPeriod = this.model.getExamsInPeriod(period.id).length;
            cost += (examsInPeriod + 1) * cfg.periodSizeWeight;
        }

        // Room penalties
        for (const rp of placement.roomPlacements) {
            cost += rp.penalty * cfg.roomPenaltyWeight;
            cost += rp.room.getPeriodPenalty(period) * cfg.roomPenaltyWeight;
        }

        // Room size penalty (utilization)
        const cap = placement.getTotalCapacity(exam.altSeating);
        const excess = cap - exam.size;
        if (excess > 0) {
            cost += excess * cfg.roomSizePenaltyWeight;
            
            // Severely penalize very low utilization
            const utilization = exam.size / cap;
            if (utilization < 0.1 && cap > 10) {
                cost += 500;
            }
        }

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
                const mt = (neighbour as any).__moveType;
                if (mt !== undefined) this.moveSuccess[mt]++;
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

        // Initialize temperature adaptively
        let sampleValues: number[] = [];
        for (let i = 0; i < 100; i++) {
            const n = this.generateNeighbour();
            if (n) {
                const v = n.value(this.model);
                if (v > 0) sampleValues.push(v);
            }
        }
        if (sampleValues.length > 0) {
            sampleValues.sort((a, b) => a - b);
            const median = sampleValues[Math.floor(sampleValues.length / 2)];
            // Probability = exp(-median / T0) = 0.5 => T0 = -median / ln(0.5)
            this.saTemperature = -median / Math.log(0.5);
            if (this.saTemperature < 0.1) this.saTemperature = this.config.saInitialTemperature;
            console.log(`[Solver] SA T0 calibrated to ${this.saTemperature.toFixed(2)} (median delta: ${median})`);
        } else {
            this.saTemperature = this.config.saInitialTemperature;
        }

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
                const mt = (neighbour as any).__moveType;
                if (mt !== undefined) this.moveSuccess[mt]++;

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
                const mt = (neighbour as any).__moveType;
                if (mt !== undefined) this.moveSuccess[mt]++;
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
                const mt = (neighbour as any).__moveType;
                if (mt !== undefined) this.moveSuccess[mt]++;
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

    // 7 move types: random, time, room, swap, conflict, kempe, group
    private moveWeights = [1, 1, 1, 1, 1, 1, 2]; // group gets higher initial weight
    private moveSuccess = [0, 0, 0, 0, 0, 0, 0];
    private moveAttempts = [0, 0, 0, 0, 0, 0, 0];

    /**
     * Generate a neighbour move using adaptive probabilities.
     * Move type 6 is the new group move that shifts all SAME_PERIOD-linked exams together.
     */
    private generateNeighbour(): ExamNeighbour | null {
        // Periodically update weights (e.g. every 1000 iterations)
        if (this.iteration > 0 && this.iteration % 1000 === 0) {
            for (let i = 0; i < this.moveWeights.length; i++) {
                if (this.moveAttempts[i] > 0) {
                    // Weight is proportional to success rate + small baseline
                    this.moveWeights[i] = 0.1 + (this.moveSuccess[i] / this.moveAttempts[i]);
                }
            }
            // Reset counters for next window
            this.moveSuccess.fill(0);
            this.moveAttempts.fill(0);
        }

        const total = this.moveWeights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        let moveType = 0;
        for (let i = 0; i < this.moveWeights.length; i++) {
            r -= this.moveWeights[i];
            if (r <= 0) { moveType = i; break; }
        }

        this.moveAttempts[moveType]++;

        let neighbour: ExamNeighbour | null = null;
        switch (moveType) {
            case 0: neighbour = generateRandomMove(this.model); break;
            case 1: neighbour = generateTimeMove(this.model); break;
            case 2: neighbour = generateRoomMove(this.model); break;
            case 3: neighbour = generatePeriodSwapMove(this.model); break;
            case 4: neighbour = generateConflictMove(this.model); break;
            case 5: neighbour = generateKempeChainMove(this.model); break;
            case 6: neighbour = this.generateGroupMove(); break;
        }

        if (neighbour) {
            (neighbour as any).__moveType = moveType;
        }

        return neighbour;
    }

    /**
     * Group move: pick a random same-time group and move ALL members to a new
     * common period together. This is the key move that makes SAME_PERIOD
     * constraints tractable — it keeps the group intact while still exploring
     * the period search space.
     */
    private generateGroupMove(): ExamNeighbour | null {
        if (this.sameTimeGroups.size === 0) return null;

        // Pick a random assigned exam
        const assigned = this.model.assignedExams;
        if (assigned.length === 0) return null;

        const seed = assigned[Math.floor(Math.random() * assigned.length)];
        const group = this.sameTimeGroups.get(seed.id) ?? [seed];

        // Only bother with actual groups (size > 1), or fallback to time move for singletons
        if (group.length <= 1) return generateTimeMove(this.model);

        // All group members must be assigned to the same period already (sanity check)
        const currentPeriodId = group[0].assignment?.period.id;
        if (!currentPeriodId) return null;

        // Find common period domain across all group members
        const periodSets = group.map(e => new Set(e.periodPlacements.map(pp => pp.period.id)));
        const commonPeriodIds = Array.from(periodSets.reduce((acc, s) => {
            const r = new Set<string>();
            for (const id of acc) if (s.has(id)) r.add(id);
            return r;
        })).filter(pid => pid !== currentPeriodId);

        if (commonPeriodIds.length === 0) return null;

        // Try a few candidate periods and pick a feasible one
        const shuffled = commonPeriodIds.sort(() => Math.random() - 0.5);
        for (const targetPeriodId of shuffled.slice(0, 5)) {
            // Check all group members are feasible in target period
            let feasible = true;
            for (const e of group) {
                if (!this.isPeriodFeasibleIgnoringGroup(e, e.periodPlacements.find(pp => pp.period.id === targetPeriodId)!, group)) {
                    feasible = false;
                    break;
                }
            }
            if (!feasible) continue;

            // Build new placements for each group member
            const newAssignments = new Map<Exam, ExamPlacement>();
            const occupied = new Set<string>(this.model.getAssignedRoomsInPeriod(targetPeriodId));
            let allRoomsFound = true;

            for (const e of group) {
                const pp = e.periodPlacements.find(p => p.period.id === targetPeriodId);
                if (!pp) { allRoomsFound = false; break; }
                const roomMap = new Map<string, Set<string>>();
                roomMap.set(targetPeriodId, new Set(occupied));
                const rooms = e.findBestAvailableRooms(pp.period, roomMap);
                if (rooms === null && e.maxRooms > 0) { allRoomsFound = false; break; }
                if (rooms) for (const rp of rooms) occupied.add(rp.room.id);
                newAssignments.set(e, new ExamPlacement(pp, rooms ?? []));
            }

            if (!allRoomsFound) continue;

            return new ExamChainNeighbour(newAssignments);
        }

        return null;
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
        for (const [examId, placement] of Array.from(this.bestAssignments.entries())) {
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
