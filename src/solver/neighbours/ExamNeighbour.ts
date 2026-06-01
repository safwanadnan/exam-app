/**
 * ExamNeighbour - Base interface for all neighbour moves.
 * Maps to CPSolver's Neighbour<Exam, ExamPlacement> interface.
 * 
 * A neighbour represents a proposed change to the current solution.
 */
import type { Exam, ExamPlacement, ExamModel } from "../model";

export interface ExamNeighbour {
    /** Apply this move to the model. Returns the improvement value (negative = better). */
    apply(model: ExamModel): number;

    /** Get the value (cost change) of this move. Negative = improvement. */
    value(model: ExamModel): number;

    /** Human-readable description */
    toString(): string;
}

/**
 * ExamSimpleNeighbour - Assign a single exam to a new placement.
 * Maps to CPSolver's ExamSimpleNeighbour.java
 */
export class ExamSimpleNeighbour implements ExamNeighbour {
    readonly exam: Exam;
    readonly placement: ExamPlacement;
    private _value: number | null;

    constructor(exam: Exam, placement: ExamPlacement, value?: number) {
        this.exam = exam;
        this.placement = placement;
        this._value = value ?? null;
    }

    value(model: ExamModel): number {
        if (this._value !== null) return this._value;
        const wasAssigned = this.exam.isAssigned;
        const oldPlacement = this.exam.assignment;
        const oldObj = model.getTotalObjective();
        model.assignExam(this.exam, this.placement);
        const newObj = model.getTotalObjective();
        // Revert
        if (wasAssigned && oldPlacement) {
            model.assignExam(this.exam, oldPlacement);
        } else {
            model.unassignExam(this.exam);
        }
        this._value = newObj - oldObj;
        return this._value;
    }

    apply(model: ExamModel): number {
        const oldObj = model.getTotalObjective();
        model.assignExam(this.exam, this.placement);
        const newObj = model.getTotalObjective();
        this._value = newObj - oldObj;
        return this._value;
    }

    toString(): string {
        return `${this.exam.name} → ${this.placement.getName()}`;
    }
}

/**
 * ExamSwapNeighbour - Swap placements between two exams.
 */
export class ExamSwapNeighbour implements ExamNeighbour {
    readonly exam1: Exam;
    readonly exam2: Exam;
    readonly placement1: ExamPlacement;
    readonly placement2: ExamPlacement;

    constructor(
        exam1: Exam, placement1: ExamPlacement,
        exam2: Exam, placement2: ExamPlacement
    ) {
        this.exam1 = exam1;
        this.placement1 = placement1;
        this.exam2 = exam2;
        this.placement2 = placement2;
    }

    value(model: ExamModel): number {
        const wasAssigned1 = this.exam1.isAssigned;
        const oldPlacement1 = this.exam1.assignment;
        const wasAssigned2 = this.exam2.isAssigned;
        const oldPlacement2 = this.exam2.assignment;

        const oldObj = model.getTotalObjective();
        model.assignExam(this.exam1, this.placement1);
        model.assignExam(this.exam2, this.placement2);
        const newObj = model.getTotalObjective();

        // Revert
        if (wasAssigned2 && oldPlacement2) model.assignExam(this.exam2, oldPlacement2);
        else model.unassignExam(this.exam2);

        if (wasAssigned1 && oldPlacement1) model.assignExam(this.exam1, oldPlacement1);
        else model.unassignExam(this.exam1);

        return newObj - oldObj;
    }

    apply(model: ExamModel): number {
        const oldObj = model.getTotalObjective();
        model.unassignExam(this.exam1);
        model.unassignExam(this.exam2);
        model.assignExam(this.exam1, this.placement1);
        model.assignExam(this.exam2, this.placement2);
        const newObj = model.getTotalObjective();
        return newObj - oldObj;
    }

    toString(): string {
        return `Swap: ${this.exam1.name} ↔ ${this.exam2.name}`;
    }
}
