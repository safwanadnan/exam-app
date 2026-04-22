import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rebuildCourseClusterConstraints } from "@/lib/section-groups";

/**
 * PATCH /api/section-groups/[id]
 * Updates section-group sync flags and rebuilds SAME_PERIOD constraints.
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const body = await request.json();
        const hasCrossInstructorFlag = typeof body.sameDayRequired === "boolean";
        const hasSameInstructorFlag = typeof body.sameInstructorSyncRequired === "boolean";

        if (!hasCrossInstructorFlag && !hasSameInstructorFlag) {
            return NextResponse.json(
                { error: "sameDayRequired or sameInstructorSyncRequired is required" },
                { status: 400 }
            );
        }

        // Fetch group context for course/session scoped rebuild.
        const group = await prisma.sectionGroup.findUnique({
            where: { id },
            include: {
                course: { select: { sessionId: true } },
            }
        });

        if (!group) {
            return NextResponse.json({ error: "Section group not found" }, { status: 404 });
        }

        const nextSameDayRequired = hasCrossInstructorFlag
            ? Boolean(body.sameDayRequired)
            : group.sameDayRequired;
        const nextSameInstructorSyncRequired = hasSameInstructorFlag
            ? Boolean(body.sameInstructorSyncRequired)
            : group.sameInstructorSyncRequired;

        let constraintsCreated = 0;
        await prisma.$transaction(async (tx) => {
            // Update the changed flags.
            await tx.sectionGroup.update({
                where: { id },
                data: {
                    sameDayRequired: nextSameDayRequired,
                    sameInstructorSyncRequired: nextSameInstructorSyncRequired,
                }
            });
            constraintsCreated = await rebuildCourseClusterConstraints(tx, group.courseId, group.course.sessionId);
        });

        return NextResponse.json({
            success: true,
            sameDayRequired: nextSameDayRequired,
            sameInstructorSyncRequired: nextSameInstructorSyncRequired,
            constraintsCreated,
        });
    } catch (error) {
        console.error("Failed to update section group:", error);
        return NextResponse.json({ error: "Failed to update section group" }, { status: 500 });
    }
}
