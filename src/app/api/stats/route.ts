export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { prisma, jsonResponse, withErrorHandling } from "@/lib/api-helpers";

export const GET = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    const [sessionCount, roomCount, examCount, studentCount, periodCount, constraintCount, activeRuns, recentSessions, recentRuns] = await Promise.all([
        prisma.academicSession.count(),
        prisma.room.count(),
        sessionId ? prisma.exam.count({ where: { examType: { sessionId } } }) : prisma.exam.count(),
        sessionId ? prisma.student.count({ where: { enrollments: { some: { exam: { examType: { sessionId } } } } } }) : prisma.student.count(),
        sessionId ? prisma.examPeriod.count({ where: { examType: { sessionId } } }) : prisma.examPeriod.count(),
        sessionId ? prisma.distributionConstraint.count({ where: { examA: { examType: { sessionId } } } }) : prisma.distributionConstraint.count(),
        prisma.solverRun.count({ where: { status: { in: ["PENDING", "RUNNING"] }, ...(sessionId ? { sessionId } : {}) } }),
        prisma.academicSession.findMany({
            take: 5,
            orderBy: { year: "desc" },
            include: { _count: { select: { examTypes: true, solverRuns: true } } },
        }),
        prisma.solverRun.findMany({
            where: sessionId ? { sessionId } : {},
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { config: { select: { name: true } } },
        }),
    ]);

    return jsonResponse({
        counts: { sessions: sessionCount, rooms: roomCount, exams: examCount, students: studentCount, periods: periodCount, constraints: constraintCount },
        activeRuns,
        recentSessions,
        recentRuns,
    });
});
