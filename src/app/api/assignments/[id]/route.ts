import { NextRequest } from "next/server";
import { prisma, jsonResponse, withErrorHandling } from "@/lib/api-helpers";

/**
 * PATCH /api/assignments/[id]
 * Manually update an assignment's period or rooms.
 *
 * Returns 409 with `roomConflicts` if any selected room is already occupied
 * at the target period. The client may add ?force=true to override and
 * save anyway (double-booking warning rather than hard block).
 */
export const PATCH = withErrorHandling(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    const body = await req.json();
    const { periodId: newPeriodId, roomIds } = body;

    // 1. Load the current assignment to get context (runId, current period)
    const current = await prisma.examAssignment.findUnique({
        where: { id },
        include: {
            rooms: { select: { roomId: true } },
        }
    });

    if (!current) {
        return jsonResponse({ error: "Assignment not found" }, 404);
    }

    const targetPeriodId = newPeriodId || current.periodId;

    // 2. Check for room conflicts: other assignments in the same run + period using the same rooms
    if (roomIds && Array.isArray(roomIds) && roomIds.length > 0 && !force) {
        const conflictingRooms = await prisma.examAssignmentRoom.findMany({
            where: {
                roomId: { in: roomIds },
                assignment: {
                    runId: current.runId,
                    periodId: targetPeriodId,
                    id: { not: id } // exclude self
                }
            },
            include: {
                room: { include: { building: true } },
                assignment: {
                    include: {
                        exam: { select: { name: true } }
                    }
                }
            }
        });

        if (conflictingRooms.length > 0) {
            const conflicts = conflictingRooms.map(c => ({
                roomName: `${c.room.building.code} ${c.room.name}`,
                roomId: c.roomId,
                usedByExam: c.assignment.exam.name || "Unnamed Exam",
                usedByAssignmentId: c.assignmentId,
            }));

            return jsonResponse({
                error: "Room conflict detected",
                roomConflicts: conflicts,
                message: `${conflicts.length} room(s) are already in use during this period.`,
            }, 409);
        }
    }

    // 3. Proceed with the update inside a transaction
    await prisma.$transaction(async (tx) => {
        if (newPeriodId) {
            await tx.examAssignment.update({
                where: { id },
                data: { periodId: newPeriodId }
            });
        }

        if (roomIds && Array.isArray(roomIds)) {
            // Remove old room assignments
            await tx.examAssignmentRoom.deleteMany({ where: { assignmentId: id } });
            // Add new room assignments
            if (roomIds.length > 0) {
                await tx.examAssignmentRoom.createMany({
                    data: roomIds.map(roomId => ({ assignmentId: id, roomId }))
                });
            }
        }
    });

    // 4. Fetch updated assignment
    const updated = await prisma.examAssignment.findUnique({
        where: { id },
        include: {
            period: true,
            rooms: { include: { room: { include: { building: true } } } }
        }
    });

    return jsonResponse({ success: true, assignment: updated });
});
