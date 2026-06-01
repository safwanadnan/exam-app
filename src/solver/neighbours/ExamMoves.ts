/**
 * ExamRandomMove - Maps to CPSolver's ExamRandomMove.java
 * 
 * Generates a random neighbour: picks a random exam and assigns it to a 
 * random feasible period+room combination.
 */
import type { ExamModel, Exam } from "../model";
import { ExamPlacement, ExamPeriodPlacement, ExamRoomPlacement } from "../model";
import { ExamSimpleNeighbour, ExamSwapNeighbour, ExamChainNeighbour, type ExamNeighbour } from "./ExamNeighbour";

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

    if (!model.isPeriodFeasible(exam, period.id)) return null;

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
            if (model.isPeriodFeasible(exam, pp.period.id)) {
                periodPlacement = pp;
                break;
            }
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

    if (!model.isPeriodFeasible(exam1, p2.period.id)) return null;
    if (!model.isPeriodFeasible(exam2, p1.period.id)) return null;

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

/**
 * ExamConflictMove
 * 
 * Target an exam that currently has conflicts, and attempt to move it to a
 * period that minimizes its local conflicts.
 */
export function generateConflictMove(model: ExamModel): ExamNeighbour | null {
    const assigned = model.assignedExams;
    if (assigned.length === 0) return null;

    // Pick an exam that currently has direct conflicts
    let exam: Exam | null = null;
    for (let i = 0; i < 5; i++) {
        const cand = assigned[Math.floor(Math.random() * assigned.length)];
        const periodId = cand.assignment!.period.id;
        let hasConflict = false;
        for (const student of cand.students) {
            if (model.getStudentExamsInPeriod(student.id, periodId).size > 1) {
                hasConflict = true;
                break;
            }
        }
        if (!hasConflict) {
            for (const instructor of cand.instructors) {
                if (model.getInstructorExamsInPeriod(instructor.id, periodId).size > 1) {
                    hasConflict = true;
                    break;
                }
            }
        }
        if (hasConflict) {
            exam = cand;
            break;
        }
    }
    
    // Fallback to random if no conflict found after 5 tries
    if (!exam) exam = assigned[Math.floor(Math.random() * assigned.length)];

    const periods = exam.periodPlacements;
    if (periods.length <= 1) return null;

    let bestPlacement: ExamPeriodPlacement | null = null;
    let minConflicts = Infinity;

    // Try a few periods and pick the one with fewest conflicts
    for (let i = 0; i < Math.min(10, periods.length); i++) {
        const pp = periods[Math.floor(Math.random() * periods.length)];
        if (pp.period.id === exam.assignment!.period.id) continue;
        if (!model.isPeriodFeasible(exam, pp.period.id)) continue;

        let conflicts = 0;
        for (const student of exam.students) {
            if (model.getStudentExamsInPeriod(student.id, pp.period.id).size > 0) conflicts++;
        }
        for (const instructor of exam.instructors) {
            if (model.getInstructorExamsInPeriod(instructor.id, pp.period.id).size > 0) conflicts++;
        }

        if (conflicts < minConflicts) {
            minConflicts = conflicts;
            bestPlacement = pp;
            if (conflicts === 0) break; // Perfect period found
        }
    }

    if (!bestPlacement) return null;

    // Find rooms for the chosen period
    const assignedRooms = model.getAssignedRoomsInPeriod(bestPlacement.period.id);
    const roomMap = new Map<string, Set<string>>();
    roomMap.set(bestPlacement.period.id, assignedRooms);

    const rooms = exam.findBestAvailableRooms(bestPlacement.period, roomMap);
    if (rooms === null) return null;

    return new ExamSimpleNeighbour(exam, new ExamPlacement(bestPlacement, rooms));
}

/**
 * ExamKempeChainMove
 * 
 * Swaps two periods for a connected component of conflicting exams.
 * Resolves deadlocks by moving an entire conflicting block at once.
 */
export function generateKempeChainMove(model: ExamModel): ExamNeighbour | null {
    const assigned = model.assignedExams;
    if (assigned.length === 0) return null;

    // Pick an initial exam
    const startExam = assigned[Math.floor(Math.random() * assigned.length)];
    const p1 = startExam.assignment!.period;

    // Pick a target period p2
    const periods = startExam.periodPlacements;
    if (periods.length <= 1) return null;
    let targetPP: ExamPeriodPlacement | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
        const pp = periods[Math.floor(Math.random() * periods.length)];
        if (pp.period.id !== p1.id) {
            targetPP = pp;
            break;
        }
    }
    if (!targetPP) return null;
    const p2 = targetPP.period;

    // Build the chain
    // We maintain sets of exams that need to be in p1 and p2.
    // Initially, startExam goes to p2.
    const toP1 = new Set<Exam>();
    const toP2 = new Set<Exam>();
    toP2.add(startExam);

    const queue: { exam: Exam, targetPeriodId: string }[] = [{ exam: startExam, targetPeriodId: p2.id }];
    const processed = new Set<string>();

    while (queue.length > 0) {
        const { exam, targetPeriodId } = queue.shift()!;
        if (processed.has(exam.id)) continue;
        processed.add(exam.id);

        const currentPeriodId = targetPeriodId === p1.id ? p2.id : p1.id;

        // Find all exams in targetPeriodId that conflict with this exam
        const conflictsInTarget = new Set<Exam>();
        
        for (const student of exam.students) {
            for (const ce of Array.from(model.getStudentExamsInPeriod(student.id, targetPeriodId))) {
                conflictsInTarget.add(ce);
            }
        }
        for (const instructor of exam.instructors) {
            for (const ce of Array.from(model.getInstructorExamsInPeriod(instructor.id, targetPeriodId))) {
                conflictsInTarget.add(ce);
            }
        }
        for (const dc of exam.distributionConstraints) {
            if (!dc.hard || !dc.isPeriodRelated()) continue;
            const otherExamId = dc.examAId === exam.id ? dc.examBId : dc.examAId;
            const otherExam = model.getExam(otherExamId);
            if (otherExam?.isAssigned && otherExam.assignment!.period.id === targetPeriodId) {
                // For simplicity, just add them to the chain
                conflictsInTarget.add(otherExam);
            }
        }

        // Move all these conflicting exams to the current period
        for (const ce of Array.from(conflictsInTarget)) {
            if (currentPeriodId === p1.id) {
                if (!toP1.has(ce)) {
                    toP1.add(ce);
                    queue.push({ exam: ce, targetPeriodId: p1.id });
                }
            } else {
                if (!toP2.has(ce)) {
                    toP2.add(ce);
                    queue.push({ exam: ce, targetPeriodId: p2.id });
                }
            }
        }
    }

    // Now we have the chain (toP1 and toP2).
    // Validate that all exams can be moved to their new periods.
    const newAssignments = new Map<Exam, ExamPlacement>();

    // We must gather all new room assignments without stepping on each other
    // For p1, the assigned rooms are currently what's in p1, minus the exams leaving p1 (toP2), plus exams coming to p1 (toP1).
    // Actually, we just compute available rooms for each exam.
    
    // Validate toP2 (exams currently in p1 moving to p2)
    const assignedRoomsP2 = model.getAssignedRoomsInPeriod(p2.id);
    // Remove rooms used by exams leaving p2 (toP1)
    for (const e of Array.from(toP1)) {
        for (const rp of e.assignment!.roomPlacements) assignedRoomsP2.delete(rp.room.id);
    }
    const roomMapP2 = new Map<string, Set<string>>();
    roomMapP2.set(p2.id, assignedRoomsP2);

    for (const e of Array.from(toP2)) {
        if (!model.isPeriodFeasible(e, p2.id)) return null;
        const pp = e.periodPlacements.find(p => p.period.id === p2.id);
        if (!pp) return null;

        const rooms = e.findBestAvailableRooms(p2, roomMapP2);
        if (rooms === null) return null;
        
        // Add chosen rooms to assignedRoomsP2 so subsequent exams in toP2 don't use them
        for (const rp of rooms) assignedRoomsP2.add(rp.room.id);
        
        newAssignments.set(e, new ExamPlacement(pp, rooms));
    }

    // Validate toP1 (exams currently in p2 moving to p1)
    const assignedRoomsP1 = model.getAssignedRoomsInPeriod(p1.id);
    // Remove rooms used by exams leaving p1 (toP2)
    for (const e of Array.from(toP2)) {
        if (e.isAssigned) {
            for (const rp of e.assignment!.roomPlacements) assignedRoomsP1.delete(rp.room.id);
        }
    }
    const roomMapP1 = new Map<string, Set<string>>();
    roomMapP1.set(p1.id, assignedRoomsP1);

    for (const e of Array.from(toP1)) {
        if (!model.isPeriodFeasible(e, p1.id)) return null;
        const pp = e.periodPlacements.find(p => p.period.id === p1.id);
        if (!pp) return null;

        const rooms = e.findBestAvailableRooms(p1, roomMapP1);
        if (rooms === null) return null;

        for (const rp of rooms) assignedRoomsP1.add(rp.room.id);

        newAssignments.set(e, new ExamPlacement(pp, rooms));
    }

    return new ExamChainNeighbour(newAssignments);
}

