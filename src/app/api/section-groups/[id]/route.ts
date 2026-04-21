import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/section-groups/[id]
 * Toggles the sameDayRequired flag for a section group.
 *
 * When turned ON:  creates SAME_DAY hard DistributionConstraints between every
 *                  pair of exams in the group.
 * When turned OFF: deletes those constraints.
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const body = await request.json();
        const sameDayRequired: boolean = Boolean(body.sameDayRequired);

        // Fetch the group with its members and their exams
        const group = await prisma.sectionGroup.findUnique({
            where: { id },
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

        if (!group) {
            return NextResponse.json({ error: "Section group not found" }, { status: 404 });
        }

        // Collect all exam IDs involved in this group
        const examIds = Array.from(
            new Set(
                group.members.flatMap(m => m.section.examOwners.map(o => o.examId))
            )
        );

        await prisma.$transaction(async (tx) => {
            // Update the flag
            await tx.sectionGroup.update({
                where: { id },
                data: { sameDayRequired }
            });

            if (examIds.length < 2) return; // Nothing to constraint if fewer than 2 exams

            if (sameDayRequired) {
                // Create SAME_DAY hard constraints for every pair
                const constraints: { type: string; hard: boolean; weight: number; examAId: string; examBId: string }[] = [];
                for (let i = 0; i < examIds.length; i++) {
                    for (let j = i + 1; j < examIds.length; j++) {
                        constraints.push({
                            type: "SAME_DAY",
                            hard: true,
                            weight: 1,
                            examAId: examIds[i],
                            examBId: examIds[j],
                        });
                    }
                }
                await tx.distributionConstraint.createMany({ data: constraints, skipDuplicates: true });
            } else {
                // Delete all SAME_DAY constraints between these exams (both directions)
                await tx.distributionConstraint.deleteMany({
                    where: {
                        type: "SAME_DAY",
                        OR: [
                            { examAId: { in: examIds }, examBId: { in: examIds } },
                        ]
                    }
                });
            }
        });

        return NextResponse.json({ success: true, sameDayRequired });
    } catch (error) {
        console.error("Failed to update section group:", error);
        return NextResponse.json({ error: "Failed to update section group" }, { status: 500 });
    }
}
