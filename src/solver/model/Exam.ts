/**
 * Exam - Maps to CPSolver's Exam.java
 * 
 * THE VARIABLE in the constraint satisfaction problem.
 * Each exam has a length, size (enrollment), seating type, max rooms,
 * and domains of possible period and room placements.
 * 
 * The solver assigns each Exam an ExamPlacement (period + rooms).
 */
import { ExamPeriod } from "./ExamPeriod";
import { ExamRoom } from "./ExamRoom";
import { ExamPlacement, ExamPeriodPlacement, ExamRoomPlacement } from "./ExamPlacement";
import { ExamStudent } from "./ExamStudent";
import { ExamInstructor } from "./ExamInstructor";
import { ExamDistributionConstraint } from "./ExamDistributionConstraint";
import type { PreferenceLevel } from "../types";

export class Exam {
    readonly id: string;
    readonly name: string;
    readonly length: number;       // Duration in minutes
    readonly altSeating: boolean;  // Requires alternate seating
    readonly maxRooms: number;     // Max rooms for splitting (0 = no room needed)
    private _minSize: number;
    private _sizeOverride: number | null;
    readonly avgPeriod: number;    // Average period index for rotation penalty
    readonly printOffset: number | null;

    // Enrolled students and assigned instructors
    private _students: ExamStudent[] = [];
    private _instructors: ExamInstructor[] = [];

    // Domain: possible placements
    private _periodPlacements: ExamPeriodPlacement[] = [];
    private _roomPlacements: ExamRoomPlacement[] = [];

    // Distribution constraints involving this exam
    private _distributionConstraints: ExamDistributionConstraint[] = [];

    // Current assignment (null if unassigned)
    private _assignment: ExamPlacement | null = null;

    // Initial assignment (for perturbation penalty)
    private _initialAssignment: ExamPlacement | null = null;

    constructor(params: {
        id: string;
        name?: string;
        length: number;
        altSeating?: boolean;
        maxRooms?: number;
        minSize?: number;
        sizeOverride?: number | null;
        avgPeriod?: number;
        printOffset?: number | null;
    }) {
        this.id = params.id;
        this.name = params.name ?? params.id;
        this.length = params.length;
        this.altSeating = params.altSeating ?? false;
        this.maxRooms = params.maxRooms ?? 4;
        this._minSize = params.minSize ?? 0;
        this._sizeOverride = params.sizeOverride ?? null;
        this.avgPeriod = params.avgPeriod ?? 0;
        this.printOffset = params.printOffset ?? null;
    }

    // ===================== SIZE =====================

    /**
     * Exam size: max of minSize and student count.
     * If sizeOverride is set, use that instead.
     */
    get size(): number {
        if (this._sizeOverride !== null) return this._sizeOverride;
        return Math.max(this._minSize, this._students.length);
    }

    set minSize(v: number) { this._minSize = v; }
    get minSize(): number { return this._minSize; }

    setSizeOverride(size: number | null): void { this._sizeOverride = size; }
    get sizeOverride(): number | null { return this._sizeOverride; }

    // ===================== STUDENTS =====================

    get students(): readonly ExamStudent[] { return this._students; }

    addStudent(student: ExamStudent): void {
        if (!this._students.includes(student)) {
            this._students.push(student);
            student.addExam(this);
        }
    }

    // ===================== INSTRUCTORS =====================

    get instructors(): readonly ExamInstructor[] { return this._instructors; }

    addInstructor(instructor: ExamInstructor): void {
        if (!this._instructors.includes(instructor)) {
            this._instructors.push(instructor);
            instructor.addExam(this);
        }
    }

    // ===================== DOMAIN =====================

    get periodPlacements(): readonly ExamPeriodPlacement[] { return this._periodPlacements; }
    get roomPlacements(): readonly ExamRoomPlacement[] { return this._roomPlacements; }

    addPeriodPlacement(pp: ExamPeriodPlacement): void {
        this._periodPlacements.push(pp);
    }

    addRoomPlacement(rp: ExamRoomPlacement): void {
        this._roomPlacements.push(rp);
    }

    setPeriodPlacements(placements: ExamPeriodPlacement[]): void {
        this._periodPlacements = placements;
    }

    setRoomPlacements(placements: ExamRoomPlacement[]): void {
        this._roomPlacements = placements;
    }

    // ===================== DISTRIBUTION CONSTRAINTS =====================

    get distributionConstraints(): readonly ExamDistributionConstraint[] {
        return this._distributionConstraints;
    }

    addDistributionConstraint(dc: ExamDistributionConstraint): void {
        if (!this._distributionConstraints.includes(dc)) {
            this._distributionConstraints.push(dc);
        }
    }

    // ===================== ASSIGNMENT =====================

    get assignment(): ExamPlacement | null { return this._assignment; }
    get isAssigned(): boolean { return this._assignment !== null; }

    assign(placement: ExamPlacement): void {
        this._assignment = placement;
    }

    unassign(): ExamPlacement | null {
        const prev = this._assignment;
        this._assignment = null;
        return prev;
    }

    get initialAssignment(): ExamPlacement | null { return this._initialAssignment; }

    setInitialAssignment(placement: ExamPlacement | null): void {
        this._initialAssignment = placement;
    }

    // ===================== DOMAIN GENERATION =====================

    /**
     * Find the best available rooms for a given period.
     * Returns a set of rooms that satisfies capacity requirements.
     * 
     * This is a faithful port of Exam.findBestAvailableRooms() from CPSolver.
     */
    findBestAvailableRooms(
        period: ExamPeriod,
        assignedRooms: Map<string, Set<string>> // periodId → Set<roomId> already assigned
    ): ExamRoomPlacement[] | null {
        if (this.maxRooms === 0) return []; // No room needed

        const usedRoomIds = assignedRooms.get(period.id) ?? new Set();

        // Filter available rooms for this period
        const availableRooms = this._roomPlacements.filter(rp =>
            rp.isAvailable(period) && !usedRoomIds.has(rp.room.id)
        );

        if (availableRooms.length === 0) return null;

        // Try single room first
        const requiredCapacity = this.size;

        // Sort rooms by penalty (ascending), then by size excess (ascending)
        const sortedRooms = [...availableRooms].sort((a, b) => {
            const pa = a.penalty + a.room.getPeriodPenalty(period);
            const pb = b.penalty + b.room.getPeriodPenalty(period);
            if (pa !== pb) return pa - pb;
            const ca = a.getCapacity(this.altSeating) - requiredCapacity;
            const cb = b.getCapacity(this.altSeating) - requiredCapacity;
            return ca - cb;
        });

        // Single room
        for (const rp of sortedRooms) {
            if (rp.getCapacity(this.altSeating) >= requiredCapacity) {
                return [rp];
            }
        }

        // Multi-room: try to find a combination of rooms
        if (this.maxRooms <= 1) return null;

        const result = this.findRoomCombination(
            sortedRooms,
            requiredCapacity,
            Math.min(this.maxRooms, sortedRooms.length)
        );

        return result;
    }

    /**
     * Find a combination of rooms that meets the capacity requirement.
     * Greedy approach: add rooms with best capacity/penalty ratio.
     */
    private findRoomCombination(
        rooms: ExamRoomPlacement[],
        requiredCapacity: number,
        maxRooms: number
    ): ExamRoomPlacement[] | null {
        // Sort by capacity descending for greedy fill
        const sorted = [...rooms].sort((a, b) =>
            b.getCapacity(this.altSeating) - a.getCapacity(this.altSeating)
        );

        const selected: ExamRoomPlacement[] = [];
        let totalCapacity = 0;

        for (const rp of sorted) {
            if (selected.length >= maxRooms) break;
            selected.push(rp);
            totalCapacity += rp.getCapacity(this.altSeating);
            if (totalCapacity >= requiredCapacity) return selected;
        }

        return null; // Cannot satisfy capacity
    }

    /**
     * Get correlated exams - exams that share students with this exam.
     * Cached for performance.
     */
    private _correlatedExams: Map<string, Exam[]> | null = null;

    getCorrelatedExams(): Exam[] {
        if (this._correlatedExams !== null) {
            return Array.from(new Set(this._correlatedExams.values()).values()).flat();
        }

        const correlated = new Map<string, Exam>();
        for (const student of this._students) {
            for (const exam of student.exams) {
                if (exam.id !== this.id && !correlated.has(exam.id)) {
                    correlated.set(exam.id, exam);
                }
            }
        }
        return Array.from(correlated.values());
    }

    /** Estimated domain size for variable ordering */
    getEstimatedDomainSize(): number {
        return this._periodPlacements.length * Math.max(1, this._roomPlacements.length);
    }

    /**
     * Compare exams for variable ordering (construction phase).
     * Larger exams with smaller domains are scheduled first.
     * Maps to Exam.compareTo() in CPSolver.
     */
    comparePriority(other: Exam): number {
        // More students = higher priority
        if (this.size !== other.size) return other.size - this.size;
        // Smaller domain = higher priority (more constrained)
        const d1 = this.getEstimatedDomainSize();
        const d2 = other.getEstimatedDomainSize();
        if (d1 !== d2) return d1 - d2;
        // More constraints = higher priority
        const c1 = this._distributionConstraints.length;
        const c2 = other._distributionConstraints.length;
        if (c1 !== c2) return c2 - c1;
        // Tie-break by ID
        return this.id.localeCompare(other.id);
    }

    toString(): string {
        return `${this.name} [${this.size} students, ${this.length}min]`;
    }
}
