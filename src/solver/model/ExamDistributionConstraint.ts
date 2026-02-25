/**
 * ExamDistributionConstraint - Maps to CPSolver's ExamDistributionConstraint.java
 * 
 * Binary distribution constraint between two exams. Supports:
 * - Same Room / Different Room
 * - Same Period / Different Period
 * - Precedence (exam A before exam B)
 * - Same Day
 * - Overlap (exams must overlap in time)
 * 
 * Each can be "hard" (required) or "soft" (preferred with weight).
 */
import { DistributionType } from "../types";
import type { ExamPeriod } from "./ExamPeriod";
import type { ExamPlacement } from "./ExamPlacement";

export class ExamDistributionConstraint {
    readonly id: string;
    readonly type: DistributionType;
    readonly hard: boolean; // true = required, false = preferred
    readonly weight: number;
    examAId: string;
    examBId: string;

    constructor(params: {
        id: string;
        type: DistributionType;
        hard: boolean;
        weight?: number;
        examAId: string;
        examBId: string;
    }) {
        this.id = params.id;
        this.type = params.type;
        this.hard = params.hard;
        this.weight = params.weight ?? 1;
        this.examAId = params.examAId;
        this.examBId = params.examBId;
    }

    /** Check if two placements satisfy this constraint */
    isSatisfied(first: ExamPlacement, second: ExamPlacement): boolean {
        switch (this.type) {
            case DistributionType.SAME_ROOM:
                return this.isSameRoom(first, second);
            case DistributionType.DIFFERENT_ROOM:
                return this.isDifferentRoom(first, second);
            case DistributionType.SAME_PERIOD:
                return this.isSamePeriod(first.period, second.period);
            case DistributionType.DIFFERENT_PERIOD:
                return this.isDifferentPeriod(first.period, second.period);
            case DistributionType.PRECEDENCE:
                return this.isPrecedenceSatisfied(first.period, second.period);
            case DistributionType.SAME_DAY:
                return this.isSameDay(first.period, second.period);
            case DistributionType.OVERLAP:
                return this.isOverlap(first.period, second.period);
            default:
                return true;
        }
    }

    /** Check if constraint is period-related (affects period selection) */
    isPeriodRelated(): boolean {
        return [
            DistributionType.SAME_PERIOD,
            DistributionType.DIFFERENT_PERIOD,
            DistributionType.PRECEDENCE,
            DistributionType.SAME_DAY,
            DistributionType.OVERLAP,
        ].includes(this.type);
    }

    /** Check if constraint is room-related (affects room selection) */
    isRoomRelated(): boolean {
        return [
            DistributionType.SAME_ROOM,
            DistributionType.DIFFERENT_ROOM,
        ].includes(this.type);
    }

    // ---------- Individual constraint checks ----------

    private isSameRoom(first: ExamPlacement, second: ExamPlacement): boolean {
        // All rooms of first must match all rooms of second
        if (first.roomPlacements.length === 0 || second.roomPlacements.length === 0) return true;
        const firstRoomIds = new Set(first.roomPlacements.map(rp => rp.room.id));
        return second.roomPlacements.every(rp => firstRoomIds.has(rp.room.id));
    }

    private isDifferentRoom(first: ExamPlacement, second: ExamPlacement): boolean {
        if (first.roomPlacements.length === 0 || second.roomPlacements.length === 0) return true;
        const firstRoomIds = new Set(first.roomPlacements.map(rp => rp.room.id));
        return !second.roomPlacements.some(rp => firstRoomIds.has(rp.room.id));
    }

    private isSamePeriod(first: ExamPeriod, second: ExamPeriod): boolean {
        return first.id === second.id;
    }

    private isDifferentPeriod(first: ExamPeriod, second: ExamPeriod): boolean {
        return first.id !== second.id;
    }

    private isPrecedenceSatisfied(first: ExamPeriod, second: ExamPeriod): boolean {
        // Exam A must be scheduled before Exam B
        return first.index < second.index;
    }

    private isSameDay(first: ExamPeriod, second: ExamPeriod): boolean {
        return first.isSameDay(second);
    }

    private isOverlap(first: ExamPeriod, second: ExamPeriod): boolean {
        return first.id === second.id || first.hasIntersection(second);
    }

    /** Check satisfaction for period-only (used during period selection) */
    isPeriodSatisfied(first: ExamPeriod, second: ExamPeriod): boolean {
        switch (this.type) {
            case DistributionType.SAME_PERIOD:
                return this.isSamePeriod(first, second);
            case DistributionType.DIFFERENT_PERIOD:
                return this.isDifferentPeriod(first, second);
            case DistributionType.PRECEDENCE:
                return this.isPrecedenceSatisfied(first, second);
            case DistributionType.SAME_DAY:
                return this.isSameDay(first, second);
            case DistributionType.OVERLAP:
                return this.isOverlap(first, second);
            default:
                return true;
        }
    }

    getTypeString(): string {
        return this.type;
    }

    toString(): string {
        return `${this.hard ? "Required" : "Preferred"} ${this.type} (${this.examAId}, ${this.examBId})`;
    }
}
