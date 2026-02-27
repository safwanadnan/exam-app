import { NextRequest, NextResponse } from "next/server";
import { prisma, jsonResponse, withErrorHandling } from "@/lib/api-helpers";

export const GET = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const runAId = url.searchParams.get("runA");
    const runBId = url.searchParams.get("runB");

    if (!runAId || !runBId) {
        return NextResponse.json({ error: "Missing run IDs" }, { status: 400 });
    }

    const [runA, runB] = await Promise.all([
        prisma.solverRun.findUnique({
            where: { id: runAId },
            include: { assignments: { include: { period: true, rooms: { include: { room: true } } } } }
        }),
        prisma.solverRun.findUnique({
            where: { id: runBId },
            include: { assignments: { include: { period: true, rooms: { include: { room: true } } } } }
        })
    ]);

    if (!runA || !runB) {
        return NextResponse.json({ error: "One or both runs not found" }, { status: 404 });
    }

    const aScores = runA.scoreDetails as any || {};
    const bScores = runB.scoreDetails as any || {};

    const diff = {
        score: {
            runA: runA.score || 0,
            runB: runB.score || 0,
            delta: (runB.score || 0) - (runA.score || 0)
        },
        conflicts: {
            runA: aScores.studentConflicts || 0,
            runB: bScores.studentConflicts || 0,
            delta: (bScores.studentConflicts || 0) - (aScores.studentConflicts || 0)
        },
        changedExams: [] as any[]
    };

    const mapA = new Map(runA.assignments.map(a => [a.examId, a]));
    const mapB = new Map(runB.assignments.map(a => [a.examId, a]));

    const allExamIds = new Set([...mapA.keys(), ...mapB.keys()]);

    for (const examId of allExamIds) {
        const a = mapA.get(examId);
        const b = mapB.get(examId);

        if (!a && b) {
            diff.changedExams.push({ examId, changeType: "ADDED", old: null, new: { periodId: b.period?.id, roomIds: b.rooms.map(r => r.roomId) } });
        } else if (a && !b) {
            diff.changedExams.push({ examId, changeType: "REMOVED", old: { periodId: a.period?.id, roomIds: a.rooms.map(r => r.roomId) }, new: null });
        } else if (a && b) {
            const periodChanged = a.period?.id !== b.period?.id;
            const aRooms = a.rooms.map(r => r.roomId).sort().join(',');
            const bRooms = b.rooms.map(r => r.roomId).sort().join(',');
            const emptyRooms = aRooms === "" && bRooms === "";

            // Only add to changedExams if the assignment actually changed
            if (periodChanged || (!emptyRooms && aRooms !== bRooms)) {
                diff.changedExams.push({
                    examId,
                    changeType: "MODIFIED",
                    periodChanged,
                    roomsChanged: aRooms !== bRooms,
                    old: {
                        period: a.period ? { startTime: a.period.startTime, endTime: a.period.endTime } : null,
                        rooms: a.rooms.map(r => r.room.name)
                    },
                    new: {
                        period: b.period ? { startTime: b.period.startTime, endTime: b.period.endTime } : null,
                        rooms: b.rooms.map(r => r.room.name)
                    }
                });
            }
        }
    }

    // Attach exam details for those that changed
    if (diff.changedExams.length > 0) {
        const exams = await prisma.exam.findMany({
            where: { id: { in: diff.changedExams.map(c => c.examId) } },
            select: { id: true, name: true }
        });
        const examMap = new Map(exams.map(e => [e.id, e.name]));

        diff.changedExams = diff.changedExams.map(c => ({
            ...c,
            examName: examMap.get(c.examId) || "Unknown Exam"
        }));
    }

    return jsonResponse({
        runA: { id: runA.id, config: runA.config, createdAt: runA.createdAt },
        runB: { id: runB.id, config: runB.config, createdAt: runB.createdAt },
        diff
    });
});
