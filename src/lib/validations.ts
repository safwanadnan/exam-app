import { z } from "zod";

export const solverConfigSchema = z.object({
    name: z.string().min(1),
    sessionId: z.string().min(1),
    isDefault: z.boolean().optional(),

    // Student weights
    directConflictWeight: z.number().optional(),
    moreThan2ADayWeight: z.number().optional(),
    backToBackConflictWeight: z.number().optional(),
    distBackToBackConflictWeight: z.number().optional(),
    backToBackDistance: z.number().optional(),
    interCampusBackToBackProhibited: z.boolean().optional(),
    interCampusDistance: z.number().optional(),
    isDayBreakBackToBack: z.boolean().optional(),
    periodPenaltyWeight: z.number().optional(),
    periodIndexWeight: z.number().optional(),
    periodSizeWeight: z.number().optional(),
    periodSizeNorm: z.number().optional(),
    roomSizePenaltyWeight: z.number().optional(),
    roomSplitPenaltyWeight: z.number().optional(),
    roomSplitDistanceWeight: z.number().optional(),
    roomPenaltyWeight: z.number().optional(),
    distributionWeight: z.number().optional(),
    perturbationWeight: z.number().optional(),
    roomPerturbationWeight: z.number().optional(),
    largeExamPenaltyWeight: z.number().optional(),
    largeExamSize: z.number().optional(),
    rotationWeight: z.number().optional(),

    // Instructor weights
    instructorDirectConflictWeight: z.number().optional(),
    instructorMoreThan2ADayWeight: z.number().optional(),
    instructorBackToBackConflictWeight: z.number().optional(),
    instructorDistBackToBackWeight: z.number().optional(),

    // Solver parameters
    maxRooms: z.number().int().optional(),
    timeout: z.number().int().optional(),
    useGreatDeluge: z.boolean().optional(),
    useColoringConstruction: z.boolean().optional(),
    checkPeriodOverlaps: z.boolean().optional(),
    examOnCourseCampus: z.boolean().optional(),

    // Simulated Annealing parameters
    saInitialTemperature: z.number().optional(),
    saCoolingRate: z.number().optional(),
    saReheatRate: z.number().optional(),
    saReheatLength: z.number().optional(),
    saRestoreBestLength: z.number().optional(),

    // Hill Climbing parameters
    hcMaxIdleIterations: z.number().int().optional(),

    // Great Deluge parameters
    gdUpperBoundRate: z.number().optional(),
    gdCoolRate: z.number().optional(),
});
