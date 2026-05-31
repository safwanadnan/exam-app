-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "campusId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Course_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Course_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Course_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Course" ("courseNumber", "createdAt", "id", "sessionId", "subjectId", "title", "updatedAt") SELECT "courseNumber", "createdAt", "id", "sessionId", "subjectId", "title", "updatedAt" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE UNIQUE INDEX "Course_courseNumber_subjectId_sessionId_key" ON "Course"("courseNumber", "subjectId", "sessionId");
CREATE TABLE "new_SolverConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "directConflictWeight" REAL NOT NULL DEFAULT 1000.0,
    "moreThan2ADayWeight" REAL NOT NULL DEFAULT 100.0,
    "backToBackConflictWeight" REAL NOT NULL DEFAULT 10.0,
    "distBackToBackConflictWeight" REAL NOT NULL DEFAULT 25.0,
    "backToBackDistance" REAL NOT NULL DEFAULT 67.0,
    "interCampusBackToBackProhibited" BOOLEAN NOT NULL DEFAULT false,
    "interCampusDistance" REAL NOT NULL DEFAULT 0.0,
    "isDayBreakBackToBack" BOOLEAN NOT NULL DEFAULT false,
    "periodPenaltyWeight" REAL NOT NULL DEFAULT 1.0,
    "periodIndexWeight" REAL NOT NULL DEFAULT 0.0000001,
    "periodSizeWeight" REAL NOT NULL DEFAULT 0.0,
    "periodSizeNorm" REAL NOT NULL DEFAULT 0.0,
    "roomSizePenaltyWeight" REAL NOT NULL DEFAULT 0.001,
    "roomSplitPenaltyWeight" REAL NOT NULL DEFAULT 10.0,
    "roomSplitDistanceWeight" REAL NOT NULL DEFAULT 0.01,
    "roomPenaltyWeight" REAL NOT NULL DEFAULT 1.0,
    "distributionWeight" REAL NOT NULL DEFAULT 1.0,
    "perturbationWeight" REAL NOT NULL DEFAULT 0.01,
    "roomPerturbationWeight" REAL NOT NULL DEFAULT 0.01,
    "largeExamPenaltyWeight" REAL NOT NULL DEFAULT 1.0,
    "largeExamSize" REAL NOT NULL DEFAULT 0.0,
    "rotationWeight" REAL NOT NULL DEFAULT 0.001,
    "instructorDirectConflictWeight" REAL NOT NULL DEFAULT 1000.0,
    "instructorMoreThan2ADayWeight" REAL NOT NULL DEFAULT 100.0,
    "instructorBackToBackConflictWeight" REAL NOT NULL DEFAULT 10.0,
    "instructorDistBackToBackWeight" REAL NOT NULL DEFAULT 25.0,
    "maxRooms" INTEGER NOT NULL DEFAULT 4,
    "timeout" INTEGER NOT NULL DEFAULT 600,
    "useGreatDeluge" BOOLEAN NOT NULL DEFAULT false,
    "useColoringConstruction" BOOLEAN NOT NULL DEFAULT false,
    "checkPeriodOverlaps" BOOLEAN NOT NULL DEFAULT false,
    "examOnCourseCampus" BOOLEAN NOT NULL DEFAULT false,
    "saInitialTemperature" REAL NOT NULL DEFAULT 1.5,
    "saCoolingRate" REAL NOT NULL DEFAULT 0.95,
    "saReheatRate" REAL NOT NULL DEFAULT -1.0,
    "saReheatLength" REAL NOT NULL DEFAULT 7.0,
    "saRestoreBestLength" REAL NOT NULL DEFAULT -1.0,
    "hcMaxIdleIterations" INTEGER NOT NULL DEFAULT 25000,
    "gdUpperBoundRate" REAL NOT NULL DEFAULT 0.999999,
    "gdCoolRate" REAL NOT NULL DEFAULT 0.9999995,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SolverConfig_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SolverConfig" ("backToBackConflictWeight", "backToBackDistance", "checkPeriodOverlaps", "createdAt", "directConflictWeight", "distBackToBackConflictWeight", "distributionWeight", "gdCoolRate", "gdUpperBoundRate", "hcMaxIdleIterations", "id", "instructorBackToBackConflictWeight", "instructorDirectConflictWeight", "instructorDistBackToBackWeight", "instructorMoreThan2ADayWeight", "interCampusBackToBackProhibited", "interCampusDistance", "isDayBreakBackToBack", "isDefault", "largeExamPenaltyWeight", "largeExamSize", "maxRooms", "moreThan2ADayWeight", "name", "periodIndexWeight", "periodPenaltyWeight", "periodSizeNorm", "periodSizeWeight", "perturbationWeight", "roomPenaltyWeight", "roomPerturbationWeight", "roomSizePenaltyWeight", "roomSplitDistanceWeight", "roomSplitPenaltyWeight", "rotationWeight", "saCoolingRate", "saInitialTemperature", "saReheatLength", "saReheatRate", "saRestoreBestLength", "sessionId", "timeout", "updatedAt", "useColoringConstruction", "useGreatDeluge") SELECT "backToBackConflictWeight", "backToBackDistance", "checkPeriodOverlaps", "createdAt", "directConflictWeight", "distBackToBackConflictWeight", "distributionWeight", "gdCoolRate", "gdUpperBoundRate", "hcMaxIdleIterations", "id", "instructorBackToBackConflictWeight", "instructorDirectConflictWeight", "instructorDistBackToBackWeight", "instructorMoreThan2ADayWeight", "interCampusBackToBackProhibited", "interCampusDistance", "isDayBreakBackToBack", "isDefault", "largeExamPenaltyWeight", "largeExamSize", "maxRooms", "moreThan2ADayWeight", "name", "periodIndexWeight", "periodPenaltyWeight", "periodSizeNorm", "periodSizeWeight", "perturbationWeight", "roomPenaltyWeight", "roomPerturbationWeight", "roomSizePenaltyWeight", "roomSplitDistanceWeight", "roomSplitPenaltyWeight", "rotationWeight", "saCoolingRate", "saInitialTemperature", "saReheatLength", "saReheatRate", "saRestoreBestLength", "sessionId", "timeout", "updatedAt", "useColoringConstruction", "useGreatDeluge" FROM "SolverConfig";
DROP TABLE "SolverConfig";
ALTER TABLE "new_SolverConfig" RENAME TO "SolverConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
