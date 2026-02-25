/**
 * ExamPeriod - Maps to CPSolver's ExamPeriod.java
 * 
 * Represents an examination time period. Periods are organized as a linked list
 * ordered chronologically. Each period has a day index and time index for
 * determining same-day and back-to-back relationships.
 */
export class ExamPeriod {
    readonly id: string;
    readonly index: number;
    readonly day: number;       // Day index (0-based)
    readonly timeIndex: number; // Time slot index within day
    readonly date: Date;
    readonly startTime: string; // "HH:MM"
    readonly endTime: string;   // "HH:MM"
    readonly length: number;    // Duration in minutes
    readonly penalty: number;   // Period penalty weight

    private _prev: ExamPeriod | null = null;
    private _next: ExamPeriod | null = null;

    constructor(params: {
        id: string;
        index: number;
        day: number;
        timeIndex: number;
        date: Date;
        startTime: string;
        endTime: string;
        length: number;
        penalty?: number;
    }) {
        this.id = params.id;
        this.index = params.index;
        this.day = params.day;
        this.timeIndex = params.timeIndex;
        this.date = params.date;
        this.startTime = params.startTime;
        this.endTime = params.endTime;
        this.length = params.length;
        this.penalty = params.penalty ?? 0;
    }

    get prev(): ExamPeriod | null { return this._prev; }
    get next(): ExamPeriod | null { return this._next; }

    setPrev(period: ExamPeriod | null): void { this._prev = period; }
    setNext(period: ExamPeriod | null): void { this._next = period; }

    /** Check if two periods are on the same day */
    isSameDay(other: ExamPeriod): boolean {
        return this.day === other.day;
    }

    /** Check if two periods are back-to-back (consecutive on same day) */
    isBackToBack(other: ExamPeriod, isDayBreakBackToBack: boolean): boolean {
        if (!isDayBreakBackToBack && !this.isSameDay(other)) return false;
        return Math.abs(this.index - other.index) === 1;
    }

    /** Get the start time in minutes since midnight */
    getStartSlot(): number {
        const [h, m] = this.startTime.split(":").map(Number);
        return h * 60 + m;
    }

    /** Get the end time in minutes since midnight */
    getEndSlot(): number {
        const [h, m] = this.endTime.split(":").map(Number);
        return h * 60 + m;
    }

    /** Check if this period overlaps with another (for period overlap mode) */
    hasIntersection(other: ExamPeriod): boolean {
        if (this.id === other.id) return false;
        if (!this.isSameDay(other)) return false;
        return this.getStartSlot() < other.getEndSlot() &&
            other.getStartSlot() < this.getEndSlot();
    }

    /**
     * Check if two exams with given lengths overlap when placed at these periods.
     * Used when checkPeriodOverlaps is enabled.
     */
    hasExamIntersection(
        exam1Length: number,
        exam2Length: number,
        otherPeriod: ExamPeriod
    ): boolean {
        if (!this.isSameDay(otherPeriod)) return false;
        const s1 = this.getStartSlot();
        const e1 = s1 + exam1Length;
        const s2 = otherPeriod.getStartSlot();
        const e2 = s2 + exam2Length;
        return s1 < e2 && s2 < e1;
    }

    toString(): string {
        return `${this.date.toISOString().split("T")[0]} ${this.startTime}-${this.endTime}`;
    }
}
