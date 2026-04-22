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

        const targetGroup = await prisma.sectionGroup.findUnique({
            where: { id },
            include: { course: { select: { sessionId: true } } }
        });

        if (!targetGroup) {
            return NextResponse.json({ error: "Section group not found" }, { status: 404 });
        }

        const nextSameDayRequired = hasCrossInstructorFlag
            ? Boolean(body.sameDayRequired)
            : targetGroup.sameDayRequired;
        const nextSameInstructorSyncRequired = hasSameInstructorFlag
            ? Boolean(body.sameInstructorSyncRequired)
            : targetGroup.sameInstructorSyncRequired;

        let constraintsCreated = 0;
        await prisma.$transaction(async (tx) => {
            await tx.sectionGroup.update({
                where: { id },
                data: {
                    sameDayRequired: nextSameDayRequired,
                    sameInstructorSyncRequired: nextSameInstructorSyncRequired,
                }
            });

            constraintsCreated = await rebuildCourseClusterConstraints(tx, targetGroup.courseId, targetGroup.course.sessionId);
        }, { timeout: 60000 });

        return NextResponse.json({
            success: true,
            sameDayRequired: nextSameDayRequired,
            sameInstructorSyncRequired: nextSameInstructorSyncRequired,
            constraintsCreated,
        });
    } catch (error) {
        console.error("Failed to update cluster constraints:", error);
        return NextResponse.json({ error: "Failed to update cluster constraints" }, { status: 500 });
    }
}
