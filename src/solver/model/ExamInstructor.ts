/**
 * ExamInstructor - Maps to CPSolver's ExamInstructor.java
 * 
 * Represents an instructor assigned to one or more exams.
 * Like ExamStudent, acts as a constraint to minimize instructor conflicts.
 */
import type { Exam } from "./Exam";
import type { ExamPeriod } from "./ExamPeriod";

export class ExamInstructor {
    readonly id: string;
    readonly externalId: string;
    readonly name: string;

    private _exams: Exam[] = [];
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

    get examCount(): number {
        return this._exams.length;
    }

    toString(): string {
        return `${this.name} (${this.externalId})`;
    }
}
