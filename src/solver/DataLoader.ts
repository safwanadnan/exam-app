/**
 * DataLoader - Bridges Prisma database to solver ExamModel.
 * 
 * Loads all exam scheduling data from the database and constructs
 * the in-memory ExamModel that the solver operates on.
 * After solving, saves results back to the database.
 */
import { PrismaClient } from "@prisma/client";
import { ExamModel } from "./model/ExamModel";
import { ExamPeriod } from "./model/ExamPeriod";
import { ExamRoom } from "./model/ExamRoom";
import { Exam } from "./model/Exam";
import { ExamPeriodPlacement, ExamRoomPlacement } from "./model/ExamPlacement";
import { ExamStudent } from "./model/ExamStudent";
import { ExamInstructor } from "./model/ExamInstructor";
import { ExamDistributionConstraint } from "./model/ExamDistributionConstraint";
import { DistributionType, type SolverConfiguration, DEFAULT_CONFIG } from "./types";

export async function loadExamModel(
    prisma: PrismaClient,
    sessionId: string,
    configId?: string
): Promise<ExamModel> {
    // Load solver config
    let config: Partial<SolverConfiguration> = {};
    if (configId) {
        const dbConfig = await prisma.solverConfig.findUnique({
            where: { id: configId },
        });
        if (dbConfig) {
            config = {
                directConflictWeight: dbConfig.directConflictWeight,
                moreThan2ADayWeight: dbConfig.moreThan2ADayWeight,
                backToBackConflictWeight: dbConfig.backToBackConflictWeight,
                distBackToBackConflictWeight: dbConfig.distBackToBackConflictWeight,
                backToBackDistance: dbConfig.backToBackDistance,
                isDayBreakBackToBack: dbConfig.isDayBreakBackToBack,
                periodPenaltyWeight: dbConfig.periodPenaltyWeight,
                periodIndexWeight: dbConfig.periodIndexWeight,
                periodSizeWeight: dbConfig.periodSizeWeight,
                periodSizeNorm: dbConfig.periodSizeNorm,
                roomSizePenaltyWeight: dbConfig.roomSizePenaltyWeight,
                roomSplitPenaltyWeight: dbConfig.roomSplitPenaltyWeight,
                roomSplitDistanceWeight: dbConfig.roomSplitDistanceWeight,
                roomPenaltyWeight: dbConfig.roomPenaltyWeight,
                distributionWeight: dbConfig.distributionWeight,
                largeExamPenaltyWeight: dbConfig.largeExamPenaltyWeight,
                largeExamSize: dbConfig.largeExamSize,
                rotationWeight: dbConfig.rotationWeight,
                perturbationWeight: dbConfig.perturbationWeight,
                roomPerturbationWeight: dbConfig.roomPerturbationWeight,
                instructorDirectConflictWeight: dbConfig.instructorDirectConflictWeight,
                instructorMoreThan2ADayWeight: dbConfig.instructorMoreThan2ADayWeight,
                instructorBackToBackConflictWeight: dbConfig.instructorBackToBackConflictWeight,
                instructorDistBackToBackWeight: dbConfig.instructorDistBackToBackWeight,
                maxRooms: dbConfig.maxRooms,
                timeout: dbConfig.timeout,
                useGreatDeluge: dbConfig.useGreatDeluge,
                useColoringConstruction: dbConfig.useColoringConstruction,
                checkPeriodOverlaps: dbConfig.checkPeriodOverlaps,
                saInitialTemperature: dbConfig.saInitialTemperature,
                saCoolingRate: dbConfig.saCoolingRate,
                saReheatRate: dbConfig.saReheatRate,
                saReheatLength: dbConfig.saReheatLength,
                saRestoreBestLength: dbConfig.saRestoreBestLength,
                hcMaxIdleIterations: dbConfig.hcMaxIdleIterations,
                gdUpperBoundRate: dbConfig.gdUpperBoundRate,
                gdCoolRate: dbConfig.gdCoolRate,
            };
        }
    }

    const model = new ExamModel(config);

    // Load exam types for this session
    const examTypes = await prisma.examType.findMany({
        where: { sessionId },
    });

    // Load periods grouped by exam type
    const dbPeriods = await prisma.examPeriod.findMany({
        where: { examType: { sessionId } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    let periodIndex = 0;
    const dayMap = new Map<string, number>(); // dateString → dayIndex
    let dayCounter = 0;

    for (const dbPeriod of dbPeriods) {
        const dateStr = dbPeriod.date.toISOString().split("T")[0];
        if (!dayMap.has(dateStr)) {
            dayMap.set(dateStr, dayCounter++);
        }
        const day = dayMap.get(dateStr)!;

        const period = new ExamPeriod({
            id: dbPeriod.id,
            index: periodIndex++,
            day,
            timeIndex: dbPeriod.timeIndex,
            date: dbPeriod.date,
            startTime: dbPeriod.startTime,
            endTime: dbPeriod.endTime,
            length: dbPeriod.length,
            penalty: dbPeriod.penalty,
        });
        model.addPeriod(period);
    }

    // Load buildings and rooms
    const dbRooms = await prisma.room.findMany({
        include: { building: true },
    });

    for (const dbRoom of dbRooms) {
        const room = new ExamRoom({
            id: dbRoom.id,
            name: `${dbRoom.building.code}-${dbRoom.name}`,
            capacity: dbRoom.capacity,
            altCapacity: dbRoom.altCapacity ?? undefined,
            coordX: dbRoom.coordX ?? dbRoom.building.coordX ?? undefined,
            coordY: dbRoom.coordY ?? dbRoom.building.coordY ?? undefined,
        });
        model.addRoom(room);

        // Load room availability
        const avail = await prisma.roomPeriodAvailability.findMany({
            where: { roomId: dbRoom.id },
        });
        for (const a of avail) {
            room.setPeriodAvailability(a.periodId, a.available ? a.penalty : -1);
        }
    }

    // Load students
    const dbStudents = await prisma.student.findMany({
        include: { unavailability: true },
    });
    for (const dbStudent of dbStudents) {
        const student = new ExamStudent({
            id: dbStudent.id,
            externalId: dbStudent.externalId,
            name: dbStudent.name,
        });
        for (const u of dbStudent.unavailability) {
            student.addUnavailablePeriod(u.periodId);
        }
        model.addStudent(student);
    }

    // Load instructors
    const dbInstructors = await prisma.instructor.findMany({
        include: { unavailability: true },
    });
    for (const dbInstructor of dbInstructors) {
        const instructor = new ExamInstructor({
            id: dbInstructor.id,
            externalId: dbInstructor.externalId,
            name: dbInstructor.name,
        });
        for (const u of dbInstructor.unavailability) {
            instructor.addUnavailablePeriod(u.periodId);
        }
        model.addInstructor(instructor);
    }

    // Load exams with relationships
    const dbExams = await prisma.exam.findMany({
        where: { examType: { sessionId } },
        include: {
            studentEnrollments: true,
            instructorAssignments: true,
            periodPreferences: true,
            roomPreferences: true,
        },
    });

    for (const dbExam of dbExams) {
        const exam = new Exam({
            id: dbExam.id,
            name: dbExam.name ?? dbExam.id,
            length: dbExam.length,
            altSeating: dbExam.altSeating,
            maxRooms: dbExam.maxRooms,
            minSize: dbExam.minSize,
            sizeOverride: dbExam.sizeOverride,
            avgPeriod: dbExam.avgPeriod,
            printOffset: dbExam.printOffset,
        });

        // Set up student enrollments
        for (const enrollment of dbExam.studentEnrollments) {
            const student = model.getStudent(enrollment.studentId);
            if (student) exam.addStudent(student);
        }

        // Set up instructor assignments
        for (const assignment of dbExam.instructorAssignments) {
            const instructor = model.getInstructor(assignment.instructorId);
            if (instructor) exam.addInstructor(instructor);
        }

        // Build period domain (all periods of the same exam type, minus prohibited)
        const prohibitedPeriods = new Set<string>();
        const periodPenalties = new Map<string, number>();
        for (const pref of dbExam.periodPreferences) {
            if (pref.level === "PROHIBITED") {
                prohibitedPeriods.add(pref.periodId);
            } else {
                periodPenalties.set(pref.periodId, getPenaltyForLevel(pref.level));
            }
        }

        for (const period of model.periods) {
            if (prohibitedPeriods.has(period.id)) continue;
            // Check period belongs to same exam type
            const dbPeriod = dbPeriods.find((p: { id: string }) => p.id === period.id);
            if (dbPeriod && dbPeriod.examTypeId !== dbExam.examTypeId) continue;

            const penalty: number = (periodPenalties.get(period.id) ?? 0) + period.penalty;
            exam.addPeriodPlacement(new ExamPeriodPlacement(period, penalty));
        }

        // Build room domain (all rooms minus prohibited)
        const prohibitedRooms = new Set<string>();
        const roomPenalties = new Map<string, number>();
        for (const pref of dbExam.roomPreferences) {
            if (pref.level === "PROHIBITED") {
                prohibitedRooms.add(pref.roomId);
            } else {
                roomPenalties.set(pref.roomId, getPenaltyForLevel(pref.level));
            }
        }

        for (const room of model.rooms) {
            if (prohibitedRooms.has(room.id)) continue;
            const penalty: number = roomPenalties.get(room.id) ?? 0;
            exam.addRoomPlacement(new ExamRoomPlacement(room, penalty));
        }

        model.addExam(exam);
    }

    // Load distribution constraints
    const dbConstraints = await prisma.distributionConstraint.findMany({
        where: {
            examA: { examType: { sessionId } },
        },
    });

    for (const dbCon of dbConstraints) {
        const dc = new ExamDistributionConstraint({
            id: dbCon.id,
            type: dbCon.type as DistributionType,
            hard: dbCon.hard,
            weight: dbCon.weight,
            examAId: dbCon.examAId,
            examBId: dbCon.examBId,
        });
        model.addDistributionConstraint(dc);
    }

    // Initialize the model
    model.init();

    return model;
}

/**
 * Save solver results back to the database.
 */
export async function saveExamResults(
    prisma: PrismaClient,
    model: ExamModel,
    runId: string
): Promise<void> {
    // Delete existing assignments for this run
    await prisma.examAssignment.deleteMany({
        where: { runId },
    });

    // Create new assignments
    for (const exam of model.exams) {
        if (!exam.isAssigned) continue;
        const placement = exam.assignment!;

        const assignment = await prisma.examAssignment.create({
            data: {
                examId: exam.id,
                periodId: placement.period.id,
                runId,
            },
        });

        // Create room assignments
        for (const rp of placement.roomPlacements) {
            await prisma.examAssignmentRoom.create({
                data: {
                    assignmentId: assignment.id,
                    roomId: rp.room.id,
                },
            });
        }
    }

    // Update solver run
    await prisma.solverRun.update({
        where: { id: runId },
        data: {
            assignedExams: model.nrAssigned,
            totalExams: model.exams.length,
            directConflicts: model.countDirectConflicts(),
            backToBackConflicts: model.countBackToBackConflicts(),
            moreThan2ADay: model.countMoreThan2ADay(),
            totalPenalty: model.getTotalObjective(),
            bestObjective: model.getTotalObjective(),
        },
    });
}

function getPenaltyForLevel(level: string): number {
    switch (level) {
        case "REQUIRED": return -100;
        case "STRONGLY_PREFERRED": return -4;
        case "PREFERRED": return -1;
        case "NEUTRAL": return 0;
        case "DISCOURAGED": return 1;
        case "STRONGLY_DISCOURAGED": return 4;
        case "PROHIBITED": return 100;
        default: return 0;
    }
}
