-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "hashedPassword" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MANAGER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AcademicSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Department_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subject_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Course_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Course_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionNumber" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Section_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SectionGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "instructorKey" TEXT NOT NULL,
    "sameInstructorSyncRequired" BOOLEAN NOT NULL DEFAULT true,
    "sameDayRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SectionGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SectionGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionGroupId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    CONSTRAINT "SectionGroupMember_sectionGroupId_fkey" FOREIGN KEY ("sectionGroupId") REFERENCES "SectionGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SectionGroupMember_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coordX" REAL,
    "coordY" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "altCapacity" INTEGER,
    "coordX" REAL,
    "coordY" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Room_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoomFeature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BOOLEAN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RoomFeatureAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    CONSTRAINT "RoomFeatureAssignment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoomFeatureAssignment_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "RoomFeature" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoomPeriodAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "penalty" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RoomPeriodAvailability_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoomPeriodAvailability_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "ExamPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    CONSTRAINT "ExamType_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examTypeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "length" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "timeIndex" INTEGER NOT NULL,
    "penalty" INTEGER NOT NULL DEFAULT 0,
    "eventId" TEXT,
    "prevPeriodId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamPeriod_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "ExamType" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamPeriod_prevPeriodId_fkey" FOREIGN KEY ("prevPeriodId") REFERENCES "ExamPeriod" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "examTypeId" TEXT NOT NULL,
    "length" INTEGER NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "minSize" INTEGER NOT NULL DEFAULT 0,
    "sizeOverride" INTEGER,
    "maxRooms" INTEGER NOT NULL DEFAULT 4,
    "altSeating" BOOLEAN NOT NULL DEFAULT false,
    "printOffset" INTEGER,
    "avgPeriod" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Exam_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "ExamType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamOwner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    CONSTRAINT "ExamOwner_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamOwner_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentEnrollment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentEnrollment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentUnavailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    CONSTRAINT "StudentUnavailability_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Instructor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InstructorAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instructorId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    CONSTRAINT "InstructorAssignment_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstructorAssignment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstructorUnavailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instructorId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    CONSTRAINT "InstructorUnavailability_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DistributionConstraint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "hard" BOOLEAN NOT NULL DEFAULT false,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "examAId" TEXT NOT NULL,
    "examBId" TEXT NOT NULL,
    CONSTRAINT "DistributionConstraint_examAId_fkey" FOREIGN KEY ("examAId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DistributionConstraint_examBId_fkey" FOREIGN KEY ("examBId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PeriodPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    CONSTRAINT "PeriodPreference_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PeriodPreference_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "ExamPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoomPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    CONSTRAINT "RoomPreference_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoomPreference_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoomFeaturePreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    CONSTRAINT "RoomFeaturePreference_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoomFeaturePreference_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "RoomFeature" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "runId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamAssignment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamAssignment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "ExamPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamAssignment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SolverRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamAssignmentRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    CONSTRAINT "ExamAssignmentRoom_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ExamAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamAssignmentRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SolverConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "directConflictWeight" REAL NOT NULL DEFAULT 1000.0,
    "moreThan2ADayWeight" REAL NOT NULL DEFAULT 100.0,
    "backToBackConflictWeight" REAL NOT NULL DEFAULT 10.0,
    "distBackToBackConflictWeight" REAL NOT NULL DEFAULT 25.0,
    "backToBackDistance" REAL NOT NULL DEFAULT 67.0,
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

-- CreateTable
CREATE TABLE "SolverRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "warmStartRunId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "totalExams" INTEGER,
    "assignedExams" INTEGER,
    "directConflicts" INTEGER,
    "backToBackConflicts" INTEGER,
    "moreThan2ADay" INTEGER,
    "totalPenalty" REAL,
    "bestObjective" REAL,
    "iterations" INTEGER,
    "phase" TEXT,
    "log" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SolverRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SolverRun_configId_fkey" FOREIGN KEY ("configId") REFERENCES "SolverConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_sessionId_key" ON "Department"("code", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_departmentId_key" ON "Subject"("code", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_courseNumber_subjectId_sessionId_key" ON "Course"("courseNumber", "subjectId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_sectionNumber_courseId_key" ON "Section"("sectionNumber", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionGroup_courseId_instructorKey_key" ON "SectionGroup"("courseId", "instructorKey");

-- CreateIndex
CREATE UNIQUE INDEX "SectionGroupMember_sectionGroupId_sectionId_key" ON "SectionGroupMember"("sectionGroupId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Building_code_key" ON "Building"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Room_name_buildingId_key" ON "Room"("name", "buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomFeature_code_key" ON "RoomFeature"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RoomFeatureAssignment_roomId_featureId_key" ON "RoomFeatureAssignment"("roomId", "featureId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPeriodAvailability_roomId_periodId_key" ON "RoomPeriodAvailability"("roomId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamType_code_sessionId_key" ON "ExamType"("code", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamPeriod_prevPeriodId_key" ON "ExamPeriod"("prevPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamPeriod_date_startTime_examTypeId_key" ON "ExamPeriod"("date", "startTime", "examTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamOwner_examId_sectionId_key" ON "ExamOwner"("examId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_externalId_key" ON "Student"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollment_studentId_examId_key" ON "StudentEnrollment"("studentId", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentUnavailability_studentId_periodId_key" ON "StudentUnavailability"("studentId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "Instructor_externalId_key" ON "Instructor"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorAssignment_instructorId_examId_key" ON "InstructorAssignment"("instructorId", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "InstructorUnavailability_instructorId_periodId_key" ON "InstructorUnavailability"("instructorId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionConstraint_type_examAId_examBId_key" ON "DistributionConstraint"("type", "examAId", "examBId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodPreference_examId_periodId_key" ON "PeriodPreference"("examId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPreference_examId_roomId_key" ON "RoomPreference"("examId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomFeaturePreference_examId_featureId_key" ON "RoomFeaturePreference"("examId", "featureId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAssignment_examId_runId_key" ON "ExamAssignment"("examId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAssignmentRoom_assignmentId_roomId_key" ON "ExamAssignmentRoom"("assignmentId", "roomId");
