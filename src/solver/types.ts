// ============================================================================
// Solver Configuration - maps to CPSolver DataProperties
// ============================================================================

export interface SolverConfiguration {
    // Student conflict weights
    directConflictWeight: number;
    moreThan2ADayWeight: number;
    backToBackConflictWeight: number;
    distBackToBackConflictWeight: number;
    backToBackDistance: number; // meters
    isDayBreakBackToBack: boolean;

    // Instructor weights
    instructorDirectConflictWeight: number;
    instructorMoreThan2ADayWeight: number;
    instructorBackToBackConflictWeight: number;
    instructorDistBackToBackWeight: number;

    // Period & room weights
    periodPenaltyWeight: number;
    periodIndexWeight: number;
    periodSizeWeight: number;
    periodSizeNorm: number;
    roomSizePenaltyWeight: number;
    roomSplitPenaltyWeight: number;
    roomSplitDistanceWeight: number;
    roomPenaltyWeight: number;
    distributionWeight: number;
    largeExamPenaltyWeight: number;
    largeExamSize: number;
    rotationWeight: number;

    // Perturbation
    perturbationWeight: number;
    roomPerturbationWeight: number;

    // Solver parameters
    maxRooms: number;
    timeout: number; // seconds
    useGreatDeluge: boolean;
    useColoringConstruction: boolean;
    checkPeriodOverlaps: boolean;

    // Simulated Annealing
    saInitialTemperature: number;
    saCoolingRate: number;
    saReheatRate: number;
    saReheatLength: number;
    saRestoreBestLength: number;

    // Hill Climbing
    hcMaxIdleIterations: number;

    // Great Deluge
    gdUpperBoundRate: number;
    gdCoolRate: number;
}

export const DEFAULT_CONFIG: SolverConfiguration = {
    directConflictWeight: 1000.0,
    moreThan2ADayWeight: 100.0,
    backToBackConflictWeight: 10.0,
    distBackToBackConflictWeight: 25.0,
    backToBackDistance: 67.0,
    isDayBreakBackToBack: false,

    instructorDirectConflictWeight: 1000.0,
    instructorMoreThan2ADayWeight: 100.0,
    instructorBackToBackConflictWeight: 10.0,
    instructorDistBackToBackWeight: 25.0,

    periodPenaltyWeight: 1.0,
    periodIndexWeight: 0.0000001,
    periodSizeWeight: 10.0,
    periodSizeNorm: 0.0,
    roomSizePenaltyWeight: 0.1,
    roomSplitPenaltyWeight: 10.0,
    roomSplitDistanceWeight: 0.01,
    roomPenaltyWeight: 1.0,
    distributionWeight: 1.0,
    largeExamPenaltyWeight: 1.0,
    largeExamSize: 0.0,
    rotationWeight: 0.001,

    perturbationWeight: 0.01,
    roomPerturbationWeight: 0.01,

    maxRooms: 4,
    timeout: 600,
    useGreatDeluge: false,
    useColoringConstruction: false,
    checkPeriodOverlaps: false,

    saInitialTemperature: 1.5,
    saCoolingRate: 0.95,
    saReheatRate: -1.0,
    saReheatLength: 7.0,
    saRestoreBestLength: -1.0,

    hcMaxIdleIterations: 25000,

    gdUpperBoundRate: 0.999999,
    gdCoolRate: 0.9999995,
};

// ============================================================================
// Preference Levels
// ============================================================================

export enum PreferenceLevel {
    REQUIRED = "REQUIRED",
    STRONGLY_PREFERRED = "STRONGLY_PREFERRED",
    PREFERRED = "PREFERRED",
    NEUTRAL = "NEUTRAL",
    DISCOURAGED = "DISCOURAGED",
    STRONGLY_DISCOURAGED = "STRONGLY_DISCOURAGED",
    PROHIBITED = "PROHIBITED",
}

export function preferencePenalty(level: PreferenceLevel): number {
    switch (level) {
        case PreferenceLevel.REQUIRED: return -100;
        case PreferenceLevel.STRONGLY_PREFERRED: return -4;
        case PreferenceLevel.PREFERRED: return -1;
        case PreferenceLevel.NEUTRAL: return 0;
        case PreferenceLevel.DISCOURAGED: return 1;
        case PreferenceLevel.STRONGLY_DISCOURAGED: return 4;
        case PreferenceLevel.PROHIBITED: return 100;
    }
}

// ============================================================================
// Distribution Constraint Types (from ExamDistributionConstraint.java)
// ============================================================================

export enum DistributionType {
    SAME_ROOM = "SAME_ROOM",
    DIFFERENT_ROOM = "DIFFERENT_ROOM",
    SAME_PERIOD = "SAME_PERIOD",
    DIFFERENT_PERIOD = "DIFFERENT_PERIOD",
    PRECEDENCE = "PRECEDENCE",
    SAME_DAY = "SAME_DAY",
    OVERLAP = "OVERLAP",
}

// ============================================================================
// Solver Status
// ============================================================================

export enum SolverStatus {
    IDLE = "IDLE",
    RUNNING = "RUNNING",
    PAUSED = "PAUSED",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    STOPPED = "STOPPED",
}

export enum SolverPhase {
    CONSTRUCTION = "CONSTRUCTION",
    COLORING = "COLORING",
    CBS_TABU = "CBS_TABU",
    HILL_CLIMBING = "HILL_CLIMBING",
    SIMULATED_ANNEALING = "SIMULATED_ANNEALING",
    GREAT_DELUGE = "GREAT_DELUGE",
    FINALIZATION = "FINALIZATION",
}

// ============================================================================
// Solver Progress Snapshot
// ============================================================================

export interface SolverProgress {
    phase: SolverPhase;
    iteration: number;
    totalExams: number;
    assignedExams: number;
    directConflicts: number;
    backToBackConflicts: number;
    moreThan2ADay: number;
    totalPenalty: number;
    bestObjective: number;
    temperature?: number; // SA temperature
    bound?: number; // GD bound
    timeElapsedMs: number;
}
