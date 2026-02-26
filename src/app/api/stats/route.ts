export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { prisma, jsonResponse, withErrorHandling } from "@/lib/api-helpers";

export const GET = withErrorHandling(async (_req: NextRequest) => {
    const [sessionCount, roomCount, examCount, studentCount, periodCount, constraintCount, activeRuns, recentSessions, recentRuns] = await Promise.all([
        prisma.academicSession.count(),
        prisma.room.count(),
        prisma.exam.count(),
        prisma.student.count(),
        prisma.examPeriod.count(),
        prisma.distributionConstraint.count(),
        prisma.solverRun.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
        prisma.academicSession.findMany({
            take: 5,
            orderBy: { year: "desc" },
            include: { _count: { select: { examTypes: true, solverRuns: true } } },
        }),
        prisma.solverRun.findMany({
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
