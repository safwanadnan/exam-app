/**
 * ExamRandomMove - Maps to CPSolver's ExamRandomMove.java
 * 
 * Generates a random neighbour: picks a random exam and assigns it to a 
 * random feasible period+room combination.
 */
import type { ExamModel } from "../model";
import { ExamPlacement, ExamPeriodPlacement, ExamRoomPlacement } from "../model";
import { ExamSimpleNeighbour, ExamSwapNeighbour, type ExamNeighbour } from "./ExamNeighbour";

export function generateRandomMove(model: ExamModel): ExamNeighbour | null {
    const exams = model.exams;
    if (exams.length === 0) return null;

    // Pick a random exam (preferring assigned ones for improvement)
    const exam = exams[Math.floor(Math.random() * exams.length)];

    const periods = exam.periodPlacements;
    if (periods.length === 0) return null;

    // Pick a random period
    const periodPlacement = periods[Math.floor(Math.random() * periods.length)];
    const period = periodPlacement.period;

    // Find available rooms
    const assignedRooms = model.getAssignedRoomsInPeriod(period.id);
    // Exclude rooms used by current exam if reassigning
    if (exam.isAssigned && exam.assignment!.period.id === period.id) {
        for (const rp of exam.assignment!.roomPlacements) {
            assignedRooms.delete(rp.room.id);
        }
    }

    const roomMap = new Map<string, Set<string>>();
    roomMap.set(period.id, assignedRooms);

    const rooms = exam.findBestAvailableRooms(period, roomMap);
    if (rooms === null) return null;

    const placement = new ExamPlacement(periodPlacement, rooms);

    // Skip if same as current
    if (exam.isAssigned && exam.assignment!.equals(placement)) return null;

    return new ExamSimpleNeighbour(exam, placement);
}

/**
 * ExamTimeMove - Maps to CPSolver's ExamTimeMove.java
 * 
 * Change an exam's period while trying to keep rooms.
 */
export function generateTimeMove(model: ExamModel): ExamNeighbour | null {
    const assigned = model.assignedExams;
    if (assigned.length === 0) return null;

    const exam = assigned[Math.floor(Math.random() * assigned.length)];
    const currentPlacement = exam.assignment!;

    const periods = exam.periodPlacements;
    if (periods.length <= 1) return null;

    // Pick a random different period
    let periodPlacement: ExamPeriodPlacement | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
        const pp = periods[Math.floor(Math.random() * periods.length)];
        if (pp.period.id !== currentPlacement.period.id) {
            periodPlacement = pp;
            break;
        }
    }
    if (!periodPlacement) return null;

    // Find best rooms for this period
    const assignedRooms = model.getAssignedRoomsInPeriod(periodPlacement.period.id);
    const roomMap = new Map<string, Set<string>>();
    roomMap.set(periodPlacement.period.id, assignedRooms);

    const rooms = exam.findBestAvailableRooms(periodPlacement.period, roomMap);
    if (rooms === null) return null;

    return new ExamSimpleNeighbour(
        exam,
        new ExamPlacement(periodPlacement, rooms)
    );
}

/**
 * ExamRoomMove - Maps to CPSolver's ExamRoomMove.java
 * 
 * Change an exam's rooms while keeping the same period.
 */
export function generateRoomMove(model: ExamModel): ExamNeighbour | null {
    const assigned = model.assignedExams;
    if (assigned.length === 0) return null;

    const exam = assigned[Math.floor(Math.random() * assigned.length)];
    if (exam.maxRooms === 0) return null; // No rooms needed

    const currentPlacement = exam.assignment!;
    const period = currentPlacement.period;

    // Get available rooms excluding current
    const assignedRooms = model.getAssignedRoomsInPeriod(period.id);
    // Remove current exam's rooms from "assigned" set so they're available
    for (const rp of currentPlacement.roomPlacements) {
        assignedRooms.delete(rp.room.id);
    }
    const roomMap = new Map<string, Set<string>>();
    roomMap.set(period.id, assignedRooms);

    // Try to find different rooms
    const rooms = exam.findBestAvailableRooms(period, roomMap);
    if (rooms === null) return null;

    const newPlacement = new ExamPlacement(currentPlacement.periodPlacement, rooms);
    if (currentPlacement.equals(newPlacement)) return null;

    return new ExamSimpleNeighbour(exam, newPlacement);
}

/**
 * ExamPeriodSwapMove - Maps to CPSolver's ExamPeriodSwapMove.java
 * 
 * Swap periods between two exams.
 */
export function generatePeriodSwapMove(model: ExamModel): ExamNeighbour | null {
    const assigned = model.assignedExams;
    if (assigned.length < 2) return null;

    const exam1 = assigned[Math.floor(Math.random() * assigned.length)];
    const exam2 = assigned[Math.floor(Math.random() * assigned.length)];
    if (exam1.id === exam2.id) return null;

    const p1 = exam1.assignment!;
    const p2 = exam2.assignment!;

    // Check if exam1 can go to exam2's period and vice versa
    const canSwap1 = exam1.periodPlacements.some(pp => pp.period.id === p2.period.id);
    const canSwap2 = exam2.periodPlacements.some(pp => pp.period.id === p1.period.id);
    if (!canSwap1 || !canSwap2) return null;

    // Find rooms for each in the new period
    const pp1 = exam1.periodPlacements.find(pp => pp.period.id === p2.period.id)!;
    const pp2 = exam2.periodPlacements.find(pp => pp.period.id === p1.period.id)!;

    // For room assignment after swap, we need to account for both exams moving
    const assignedRooms1 = model.getAssignedRoomsInPeriod(p2.period.id);
    // Remove exam2's current rooms (it's leaving this period)
    for (const rp of p2.roomPlacements) assignedRooms1.delete(rp.room.id);
    const roomMap1 = new Map<string, Set<string>>();
    roomMap1.set(p2.period.id, assignedRooms1);

    const rooms1 = exam1.findBestAvailableRooms(p2.period, roomMap1);
    if (rooms1 === null) return null;

    const assignedRooms2 = model.getAssignedRoomsInPeriod(p1.period.id);
    // Remove exam1's current rooms (it's leaving this period)
    for (const rp of p1.roomPlacements) assignedRooms2.delete(rp.room.id);
    // Add rooms1 (exam1's new rooms in p2's period — but that's a different period)
    const roomMap2 = new Map<string, Set<string>>();
    roomMap2.set(p1.period.id, assignedRooms2);

    const rooms2 = exam2.findBestAvailableRooms(p1.period, roomMap2);
    if (rooms2 === null) return null;

    return new ExamSwapNeighbour(
        exam1, new ExamPlacement(pp1, rooms1),
        exam2, new ExamPlacement(pp2, rooms2)
    );
}
