/**
 * ExamRoom - Maps to CPSolver's ExamRoom.java
 * 
 * Represents an examination room. Each room has a normal seating capacity
 * and an optional alternate seating capacity. Rooms can be marked as 
 * available/unavailable for specific periods with penalty values.
 * Rooms support distance calculations via coordinates for back-to-back
 * distance constraints.
 */
import { ExamPeriod } from "./ExamPeriod";

export class ExamRoom {
    readonly id: string;
    readonly name: string;
    readonly capacity: number;      // Normal seating
    readonly altCapacity: number;   // Alternate (exam) seating
    readonly coordX: number;
    readonly coordY: number;

    // Period availability: periodId → penalty (undefined = available with 0 penalty, -1 = prohibited)
    private _periodAvailability: Map<string, number> = new Map();

    constructor(params: {
        id: string;
        name: string;
        capacity: number;
        altCapacity?: number;
        coordX?: number;
        coordY?: number;
    }) {
        this.id = params.id;
        this.name = params.name;
        this.capacity = params.capacity;
        this.altCapacity = params.altCapacity ?? params.capacity;
        this.coordX = params.coordX ?? 0;
        this.coordY = params.coordY ?? 0;
    }

    /** Get the capacity based on seating type */
    getCapacity(altSeating: boolean): number {
        return altSeating ? this.altCapacity : this.capacity;
    }

    /** Set availability/penalty for a specific period */
    setPeriodAvailability(periodId: string, penalty: number): void {
        this._periodAvailability.set(periodId, penalty);
    }

    /** Check if room is available during a period */
    isAvailable(period: ExamPeriod): boolean {
        const penalty = this._periodAvailability.get(period.id);
        return penalty === undefined || penalty >= 0;
    }

    /** Get the penalty for using this room during a period */
    getPeriodPenalty(period: ExamPeriod): number {
        return this._periodAvailability.get(period.id) ?? 0;
    }

    /** Check if room is prohibited during a period */
    isProhibited(period: ExamPeriod): boolean {
        const penalty = this._periodAvailability.get(period.id);
        return penalty !== undefined && penalty < 0;
    }

    /**
     * Calculate Euclidean distance to another room (in meters).
     * Used for distance back-to-back conflict detection.
     */
    getDistanceInMeters(other: ExamRoom): number {
        const dx = this.coordX - other.coordX;
        const dy = this.coordY - other.coordY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    toString(): string {
        return this.name;
    }
}
