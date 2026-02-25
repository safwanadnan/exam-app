/**
 * ExamRoomPlacement - Maps to CPSolver's ExamRoomPlacement.java
 * 
 * Represents the assignment of an exam to a specific room with associated penalty.
 */
import { ExamRoom } from "./ExamRoom";
import type { ExamPeriod } from "./ExamPeriod";

export class ExamRoomPlacement {
    readonly room: ExamRoom;
    readonly penalty: number; // Room preference penalty

    constructor(room: ExamRoom, penalty: number = 0) {
        this.room = room;
        this.penalty = penalty;
    }

    get id(): string { return this.room.id; }
    get name(): string { return this.room.name; }

    getCapacity(altSeating: boolean): number {
        return this.room.getCapacity(altSeating);
    }

    isAvailable(period: ExamPeriod): boolean {
        return this.room.isAvailable(period);
    }

    toString(): string {
        return this.room.name;
    }
}

/**
 * ExamPeriodPlacement - Maps to CPSolver's ExamPeriodPlacement.java
 * 
 * Represents the assignment of an exam to a specific period with associated penalty.
 */
export class ExamPeriodPlacement {
    readonly period: ExamPeriod;
    readonly penalty: number; // Period preference penalty

    constructor(period: ExamPeriod, penalty: number = 0) {
        this.period = period;
        this.penalty = penalty;
    }

    get id(): string { return this.period.id; }

    toString(): string {
        return this.period.toString();
    }
}

/**
 * ExamPlacement - Maps to CPSolver's ExamPlacement.java
 * 
 * Represents a complete exam placement (the "value" in the constraint problem):
 * an assignment of an exam to a period and a set of rooms.
 */
export class ExamPlacement {
    readonly periodPlacement: ExamPeriodPlacement;
    readonly roomPlacements: ExamRoomPlacement[];

    constructor(
        periodPlacement: ExamPeriodPlacement,
        roomPlacements: ExamRoomPlacement[] = []
    ) {
        this.periodPlacement = periodPlacement;
        this.roomPlacements = [...roomPlacements];
    }

    get period(): ExamPeriod {
        return this.periodPlacement.period;
    }

    get rooms(): ExamRoom[] {
        return this.roomPlacements.map(rp => rp.room);
    }

    /** Total room capacity for this placement */
    getTotalCapacity(altSeating: boolean): number {
        return this.roomPlacements.reduce(
            (sum, rp) => sum + rp.getCapacity(altSeating), 0
        );
    }

    /** Maximum distance between any two rooms in this placement (for split penalty) */
    getMaxRoomDistance(): number {
        let maxDist = 0;
        for (let i = 0; i < this.roomPlacements.length; i++) {
            for (let j = i + 1; j < this.roomPlacements.length; j++) {
                const dist = this.roomPlacements[i].room.getDistanceInMeters(
                    this.roomPlacements[j].room
                );
                if (dist > maxDist) maxDist = dist;
            }
        }
        return maxDist;
    }

    /** Distance to another placement (max room-to-room distance) */
    getDistanceInMeters(other: ExamPlacement): number {
        let maxDist = 0;
        for (const rp1 of this.roomPlacements) {
            for (const rp2 of other.roomPlacements) {
                const dist = rp1.room.getDistanceInMeters(rp2.room);
                if (dist > maxDist) maxDist = dist;
            }
        }
        return maxDist;
    }

    /** Check if a specific room is in this placement */
    containsRoom(room: ExamRoom): boolean {
        return this.roomPlacements.some(rp => rp.room.id === room.id);
    }

    /** Room names for display */
    getRoomName(delim: string = ", "): string {
        return this.roomPlacements.map(rp => rp.name).join(delim);
    }

    getName(): string {
        return `${this.period.toString()} / ${this.getRoomName()}`;
    }

    equals(other: ExamPlacement): boolean {
        if (this.period.id !== other.period.id) return false;
        if (this.roomPlacements.length !== other.roomPlacements.length) return false;
        const thisRoomIds = new Set(this.roomPlacements.map(rp => rp.room.id));
        return other.roomPlacements.every(rp => thisRoomIds.has(rp.room.id));
    }

    toString(): string {
        return this.getName();
    }
}
