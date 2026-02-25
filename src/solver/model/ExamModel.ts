/**
 * ExamModel - Maps to CPSolver's ExamModel.java
 * 
 * THE CENTRAL MODEL holding the entire exam timetabling problem:
 * - All exams (variables)
 * - All periods, rooms (constraints)
 * - All students, instructors (soft constraints)
 * - All distribution constraints
 * - Assignment tracking with indexed lookups
 * 
 * Provides fast lookup maps for conflict detection:
 * - period → student → assigned exams
 * - period → room → assigned exam
 */
import { ExamPeriod } from "./ExamPeriod";
import { ExamRoom } from "./ExamRoom";
import { Exam } from "./Exam";
import { ExamPlacement } from "./ExamPlacement";
import { ExamStudent } from "./ExamStudent";
import { ExamInstructor } from "./ExamInstructor";
import { ExamDistributionConstraint } from "./ExamDistributionConstraint";
import type { SolverConfiguration } from "../types";
import { DEFAULT_CONFIG } from "../types";

export class ExamModel {
    readonly config: SolverConfiguration;

    // Problem data
    private _periods: ExamPeriod[] = [];
    private _rooms: ExamRoom[] = [];
    private _exams: Exam[] = [];
    private _students: ExamStudent[] = [];
    private _instructors: ExamInstructor[] = [];
    private _distributionConstraints: ExamDistributionConstraint[] = [];

    // Lookup maps
    private _examById: Map<string, Exam> = new Map();
    private _periodById: Map<string, ExamPeriod> = new Map();
    private _roomById: Map<string, ExamRoom> = new Map();
    private _studentById: Map<string, ExamStudent> = new Map();
    private _instructorById: Map<string, ExamInstructor> = new Map();

    // Assignment index: period → student → Set<Exam>
    private _studentsOfPeriod: Map<string, Map<string, Set<Exam>>> = new Map();

    // Assignment index: period → instructor → Set<Exam>
    private _instructorsOfPeriod: Map<string, Map<string, Set<Exam>>> = new Map();

    // Assignment index: period → room → Exam (room exclusivity)
    private _roomsOfPeriod: Map<string, Map<string, Exam>> = new Map();

    // Day grouping
    private _periodsOfDay: Map<number, ExamPeriod[]> = new Map();
    private _nrDays: number = 0;

    constructor(config?: Partial<SolverConfiguration>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // ===================== GETTERS =====================

    get periods(): readonly ExamPeriod[] { return this._periods; }
    get rooms(): readonly ExamRoom[] { return this._rooms; }
    get exams(): readonly Exam[] { return this._exams; }
    get students(): readonly ExamStudent[] { return this._students; }
    get instructors(): readonly ExamInstructor[] { return this._instructors; }
    get distributionConstraints(): readonly ExamDistributionConstraint[] { return this._distributionConstraints; }
    get nrDays(): number { return this._nrDays; }

    getExam(id: string): Exam | undefined { return this._examById.get(id); }
    getPeriod(id: string): ExamPeriod | undefined { return this._periodById.get(id); }
    getRoom(id: string): ExamRoom | undefined { return this._roomById.get(id); }
    getStudent(id: string): ExamStudent | undefined { return this._studentById.get(id); }
    getInstructor(id: string): ExamInstructor | undefined { return this._instructorById.get(id); }

    getPeriodsOfDay(day: number): ExamPeriod[] {
        return this._periodsOfDay.get(day) ?? [];
    }

    // ===================== ADDING DATA =====================

    addPeriod(period: ExamPeriod): void {
        this._periods.push(period);
        this._periodById.set(period.id, period);

        // Link to previous period
        if (this._periods.length > 1) {
            const prev = this._periods[this._periods.length - 2];
            prev.setNext(period);
            period.setPrev(prev);
        }

        // Track days
        if (!this._periodsOfDay.has(period.day)) {
            this._periodsOfDay.set(period.day, []);
            this._nrDays++;
        }
        this._periodsOfDay.get(period.day)!.push(period);

        // Initialize index maps for this period
        this._studentsOfPeriod.set(period.id, new Map());
        this._instructorsOfPeriod.set(period.id, new Map());
        this._roomsOfPeriod.set(period.id, new Map());
    }

    addRoom(room: ExamRoom): void {
        this._rooms.push(room);
        this._roomById.set(room.id, room);
    }

    addExam(exam: Exam): void {
        this._exams.push(exam);
        this._examById.set(exam.id, exam);
    }

    addStudent(student: ExamStudent): void {
        this._students.push(student);
        this._studentById.set(student.id, student);
    }

    addInstructor(instructor: ExamInstructor): void {
        this._instructors.push(instructor);
        this._instructorById.set(instructor.id, instructor);
    }

    addDistributionConstraint(dc: ExamDistributionConstraint): void {
        this._distributionConstraints.push(dc);
        // Link to exams
        const examA = this._examById.get(dc.examAId);
        const examB = this._examById.get(dc.examBId);
        if (examA) examA.addDistributionConstraint(dc);
        if (examB) examB.addDistributionConstraint(dc);
    }

    // ===================== ASSIGNMENT MANAGEMENT =====================

    /**
     * Assign an exam to a placement. Updates all index maps.
     */
    assignExam(exam: Exam, placement: ExamPlacement): void {
        // Remove old assignment if any
        if (exam.isAssigned) {
            this.unassignExam(exam);
        }

        exam.assign(placement);
        const periodId = placement.period.id;

        // Update student-period index
        const studentMap = this._studentsOfPeriod.get(periodId)!;
        for (const student of exam.students) {
            if (!studentMap.has(student.id)) {
                studentMap.set(student.id, new Set());
            }
            studentMap.get(student.id)!.add(exam);
        }

        // Update instructor-period index
        const instructorMap = this._instructorsOfPeriod.get(periodId)!;
        for (const instructor of exam.instructors) {
            if (!instructorMap.has(instructor.id)) {
                instructorMap.set(instructor.id, new Set());
            }
            instructorMap.get(instructor.id)!.add(exam);
        }

        // Update room-period index
        const roomMap = this._roomsOfPeriod.get(periodId)!;
        for (const rp of placement.roomPlacements) {
            roomMap.set(rp.room.id, exam);
        }
    }

    /**
     * Unassign an exam. Removes from all index maps.
     */
    unassignExam(exam: Exam): ExamPlacement | null {
        const placement = exam.assignment;
        if (!placement) return null;

        const periodId = placement.period.id;

        // Remove from student-period index
        const studentMap = this._studentsOfPeriod.get(periodId);
        if (studentMap) {
            for (const student of exam.students) {
                const exams = studentMap.get(student.id);
                if (exams) {
                    exams.delete(exam);
                    if (exams.size === 0) studentMap.delete(student.id);
                }
            }
        }

        // Remove from instructor-period index
        const instructorMap = this._instructorsOfPeriod.get(periodId);
        if (instructorMap) {
            for (const instructor of exam.instructors) {
                const exams = instructorMap.get(instructor.id);
                if (exams) {
                    exams.delete(exam);
                    if (exams.size === 0) instructorMap.delete(instructor.id);
                }
            }
        }

        // Remove from room-period index
        const roomMap = this._roomsOfPeriod.get(periodId);
        if (roomMap) {
            for (const rp of placement.roomPlacements) {
                roomMap.delete(rp.room.id);
            }
        }

        exam.unassign();
        return placement;
    }

    // ===================== CONFLICT QUERIES =====================

    /**
     * Get exams of a specific student in a period.
     * Used for direct conflict, back-to-back, more-than-2-a-day detection.
     */
    getStudentExamsInPeriod(studentId: string, periodId: string): Set<Exam> {
        return this._studentsOfPeriod.get(periodId)?.get(studentId) ?? new Set();
    }

    /**
     * Get all student-exam mappings for a period.
     * Returns Map<studentId, Set<Exam>>
     */
    getStudentsOfPeriod(periodId: string): Map<string, Set<Exam>> {
        return this._studentsOfPeriod.get(periodId) ?? new Map();
    }

    /**
     * Get instructor exams in a period.
     */
    getInstructorExamsInPeriod(instructorId: string, periodId: string): Set<Exam> {
        return this._instructorsOfPeriod.get(periodId)?.get(instructorId) ?? new Set();
    }

    getInstructorsOfPeriod(periodId: string): Map<string, Set<Exam>> {
        return this._instructorsOfPeriod.get(periodId) ?? new Map();
    }

    /**
     * Get the exam assigned to a specific room in a specific period.
     * Returns null if room is free.
     */
    getRoomExam(roomId: string, periodId: string): Exam | undefined {
        return this._roomsOfPeriod.get(periodId)?.get(roomId);
    }

    /**
     * Check if a room is free during a period.
     */
    isRoomFree(roomId: string, periodId: string): boolean {
        return !this._roomsOfPeriod.get(periodId)?.has(roomId);
    }

    /**
     * Get all assigned room IDs for a period.
     */
    getAssignedRoomsInPeriod(periodId: string): Set<string> {
        const roomMap = this._roomsOfPeriod.get(periodId);
        return roomMap ? new Set(roomMap.keys()) : new Set();
    }

    // ===================== SOLUTION STATISTICS =====================

    get assignedExams(): Exam[] {
        return this._exams.filter(e => e.isAssigned);
    }

    get unassignedExams(): Exam[] {
        return this._exams.filter(e => !e.isAssigned);
    }

    get nrAssigned(): number {
        return this._exams.filter(e => e.isAssigned).length;
    }

    get nrUnassigned(): number {
        return this._exams.filter(e => !e.isAssigned).length;
    }

    /** Count total student direct conflicts */
    countDirectConflicts(): number {
        let count = 0;
        for (const [, studentMap] of this._studentsOfPeriod) {
            for (const [, exams] of studentMap) {
                if (exams.size > 1) count += exams.size - 1;
            }
        }
        return count;
    }

    /** Count students with back-to-back exams */
    countBackToBackConflicts(): number {
        let count = 0;
        for (const student of this._students) {
            for (const exam1 of student.exams) {
                if (!exam1.isAssigned) continue;
                for (const exam2 of student.exams) {
                    if (!exam2.isAssigned) continue;
                    if (exam1.id >= exam2.id) continue; // Avoid double-counting
                    const p1 = exam1.assignment!.period;
                    const p2 = exam2.assignment!.period;
                    if (p1.isBackToBack(p2, this.config.isDayBreakBackToBack)) {
                        count++;
                    }
                }
            }
        }
        return count;
    }

    /** Count students with more than 2 exams in a day */
    countMoreThan2ADay(): number {
        let count = 0;
        for (const student of this._students) {
            const examsPerDay = new Map<number, number>();
            for (const exam of student.exams) {
                if (!exam.isAssigned) continue;
                const day = exam.assignment!.period.day;
                examsPerDay.set(day, (examsPerDay.get(day) ?? 0) + 1);
            }
            for (const [, n] of examsPerDay) {
                if (n > 2) count += n - 2;
            }
        }
        return count;
    }

    /**
     * Compute total weighted objective value of current solution.
     */
    getTotalObjective(): number {
        const cfg = this.config;
        let total = 0;

        total += this.countDirectConflicts() * cfg.directConflictWeight;
        total += this.countBackToBackConflicts() * cfg.backToBackConflictWeight;
        total += this.countMoreThan2ADay() * cfg.moreThan2ADayWeight;

        // Period penalties
        for (const exam of this._exams) {
            if (!exam.isAssigned) continue;
            total += exam.assignment!.periodPlacement.penalty * cfg.periodPenaltyWeight;
            total += exam.assignment!.period.index * cfg.periodIndexWeight;
        }

        // Room penalties
        for (const exam of this._exams) {
            if (!exam.isAssigned) continue;
            const placement = exam.assignment!;

            // Room preference penalty
            for (const rp of placement.roomPlacements) {
                total += rp.penalty * cfg.roomPenaltyWeight;
            }

            // Room size penalty (excess)
            const excess = placement.getTotalCapacity(exam.altSeating) - exam.size;
            if (excess > 0) total += excess * cfg.roomSizePenaltyWeight;

            // Room split penalty
            if (placement.roomPlacements.length > 1) {
                total += (placement.roomPlacements.length - 1) * cfg.roomSplitPenaltyWeight;
                total += placement.getMaxRoomDistance() * cfg.roomSplitDistanceWeight;
            }
        }

        // Distribution constraint penalties
        for (const dc of this._distributionConstraints) {
            if (dc.hard) continue; // Hard constraints are either satisfied or cause unassignment
            const examA = this._examById.get(dc.examAId);
            const examB = this._examById.get(dc.examBId);
            if (!examA?.isAssigned || !examB?.isAssigned) continue;
            if (!dc.isSatisfied(examA.assignment!, examB.assignment!)) {
                total += dc.weight * cfg.distributionWeight;
            }
        }

        return total;
    }

    // ===================== INITIALIZATION =====================

    /**
     * Initialize all exams' domains (possible placements).
     * Should be called after all data is loaded.
     */
    init(): void {
        // Sort periods chronologically
        this._periods.sort((a, b) => a.index - b.index);

        // Re-link periods
        for (let i = 0; i < this._periods.length; i++) {
            this._periods[i].setPrev(i > 0 ? this._periods[i - 1] : null);
            this._periods[i].setNext(i < this._periods.length - 1 ? this._periods[i + 1] : null);
        }

        console.log(`[ExamModel] Initialized: ${this._exams.length} exams, ${this._periods.length} periods, ${this._rooms.length} rooms, ${this._students.length} students, ${this._instructors.length} instructors, ${this._distributionConstraints.length} constraints`);
    }

    toString(): string {
        return `ExamModel[${this._exams.length} exams, ${this._periods.length} periods, ${this._rooms.length} rooms, ${this.nrAssigned}/${this._exams.length} assigned]`;
    }
}
