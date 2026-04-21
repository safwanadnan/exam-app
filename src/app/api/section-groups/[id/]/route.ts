import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/section-groups/[id]
 * Toggles the sameDayRequired flag for a section group.
 *
 * This handler is cluster-aware: it re-syncs ALL SAME_PERIOD constraints
 * for the entire course cluster when one teacher's toggle is changed.
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const body = await request.json();
        const sameDayRequired: boolean = Boolean(body.sameDayRequired);

        // 1. Fetch the target group and its cluster siblings
        const targetGroup = await prisma.sectionGroup.findUnique({
            where: { id },
            select: { courseId: true }
        });

        if (!targetGroup) {
            return NextResponse.json({ error: "Section group not found" }, { status: 404 });
        }

        const clusterGroups = await prisma.sectionGroup.findMany({
            where: { courseId: targetGroup.courseId },
            include: {
                members: {
                    include: {
                        section: {
                            include: {
                                examOwners: { select: { examId: true } }
                            }
                        }
                    }
                }
            }
        });

        // Map to hold exam sets per group
        const groupExams = clusterGroups.map(g => ({
            id: g.id,
            isActive: g.id === id ? sameDayRequired : g.sameDayRequired,
            examIds: Array.from(new Set(g.members.flatMap(m => m.section.examOwners.map(o => o.examId))))
        }));

        const allClusterExamIds = Array.from(new Set(groupExams.flatMap(ge => ge.examIds)));

        await prisma.$transaction(async (tx) => {
            // A. Update the target group flag
            await tx.sectionGroup.update({
                where: { id },
                data: { sameDayRequired }
            });

            // B. Clean all SAME_PERIOD constraints within this course cluster
            if (allClusterExamIds.length > 0) {
                await tx.distributionConstraint.deleteMany({
                    where: {
                        type: "SAME_PERIOD",
                        hard: true,
                        examAId: { in: allClusterExamIds },
                        examBId: { in: allClusterExamIds },
                    }
                });
            }

            // C. Re-generate hierarchical constraints for the cluster
            const newConstraints: any[] = [];
            const constraintKeys = new Set<string>();

            const addConstraint = (type: string, aId: string, bId: string) => {
                const [first, second] = aId < bId ? [aId, bId] : [bId, aId];
                const key = `${type}:${first}:${second}`;
                if (constraintKeys.has(key)) return;
                constraintKeys.add(key);
                newConstraints.push({
                    type,
                    hard: true,
                    weight: 1,
                    examAId: first,
                    examBId: second,
                });
            };

            // 1. Mandatory Intra-Group
            for (const ge of groupExams) {
                for (let i = 0; i < ge.examIds.length; i++) {
                    for (let j = i + 1; j < ge.examIds.length; j++) {
                        addConstraint("SAME_PERIOD", ge.examIds[i], ge.examIds[j]);
                    }
                }
            }

            // 2. Inter-Group (Toggle sync)
            for (let i = 0; i < groupExams.length; i++) {
                if (!groupExams[i].isActive) continue;
                for (let j = i + 1; j < groupExams.length; j++) {
                    if (!groupExams[j].isActive) continue;
                    
                    for (const examA of groupExams[i].examIds) {
                        for (const examB of groupExams[j].examIds) {
                            addConstraint("SAME_PERIOD", examA, examB);
                        }
                    }
                }
            }

            if (newConstraints.length > 0) {
                await tx.distributionConstraint.createMany({
                    data: newConstraints,
                    // Note: overlapping exams might exist if shared, but usually distinct by our key
                });
            }
        }, { timeout: 60000 });

        return NextResponse.json({ success: true, sameDayRequired });
    } catch (error) {
        console.error("Failed to update cluster constraints:", error);
        return NextResponse.json({ error: "Failed to update cluster constraints" }, { status: 500 });
    }
}
