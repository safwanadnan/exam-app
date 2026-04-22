-- Add same-instructor sync flag (default ON)
ALTER TABLE "SectionGroup" ADD COLUMN "sameInstructorSyncRequired" BOOLEAN NOT NULL DEFAULT true;

-- Change cross-instructor sync default to OFF
CREATE TABLE "new_SectionGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "instructorKey" TEXT NOT NULL,
    "sameInstructorSyncRequired" BOOLEAN NOT NULL DEFAULT true,
    "sameDayRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SectionGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_SectionGroup" (
    "id",
    "courseId",
    "instructorKey",
    "sameInstructorSyncRequired",
    "sameDayRequired",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "courseId",
    "instructorKey",
    COALESCE("sameInstructorSyncRequired", true),
    "sameDayRequired",
    "createdAt",
    "updatedAt"
FROM "SectionGroup";

DROP TABLE "SectionGroup";
ALTER TABLE "new_SectionGroup" RENAME TO "SectionGroup";
CREATE UNIQUE INDEX "SectionGroup_courseId_instructorKey_key" ON "SectionGroup"("courseId", "instructorKey");