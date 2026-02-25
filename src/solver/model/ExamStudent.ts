/**
 * ExamStudent - Maps to CPSolver's ExamStudent.java
 * 
 * Represents a student enrolled in one or more exams. ExamStudent acts as a
 * constraint in the solver: the solver must minimize conflicts where a student
 * has overlapping or back-to-back exams.
 */
import type { Exam } from "./Exam";
import type { ExamPeriod } from "./ExamPeriod";

export class ExamStudent {
    readonly id: string;
    readonly externalId: string;
    readonly name: string;

    // Exams this student is enrolled in
    private _exams: Exam[] = [];

    // Periods when student is unavailable
    private _unavailablePeriods: Set<string> = new Set();

    constructor(params: {
        id: string;
        externalId: string;
        name: string;
    }) {
        this.id = params.id;
        this.externalId = params.externalId;
        this.name = params.name;
    }

    get exams(): readonly Exam[] { return this._exams; }

    addExam(exam: Exam): void {
        if (!this._exams.includes(exam)) {
            this._exams.push(exam);
        }
    }

    removeExam(exam: Exam): void {
        const idx = this._exams.indexOf(exam);
        if (idx >= 0) this._exams.splice(idx, 1);
    }

    addUnavailablePeriod(periodId: string): void {
        this._unavailablePeriods.add(periodId);
    }

    isAvailable(period: ExamPeriod): boolean {
        return !this._unavailablePeriods.has(period.id);
    }

    /** Get the number of exams this student has */
    get examCount(): number {
        return this._exams.length;
    }

    toString(): string {
        return `${this.name} (${this.externalId})`;
    }
}
