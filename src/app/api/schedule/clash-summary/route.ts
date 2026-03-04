export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { prisma, jsonResponse, withErrorHandling } from "@/lib/api-helpers";

/**
 * GET /api/schedule/clash-summary?runId=…
 * 
 * Returns a map of assignmentId → total number of students
 * who are double-booked in the same period.
 * Used by the schedule page to pre-highlight conflicted exam cards.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const runId = url.searchParams.get("runId");

    if (!runId) {
        return jsonResponse({ error: "runId is required" }, 400);
    }

    // Load all assignments for this run with their student enrollments
    const assignments = await prisma.examAssignment.findMany({
        where: { runId },
        include: {
            exam: {
                include: {
                    studentEnrollments: { select: { studentId: true } },
                },
            },
        },
    });

    // Build a map: periodId → list of { assignmentId, studentIds }
    const periodMap = new Map<string, { assignmentId: string; studentIds: Set<string> }[]>();
    for (const a of assignments) {
        const studentIds = new Set(a.exam.studentEnrollments.map(e => e.studentId));
        if (!periodMap.has(a.periodId)) {
            periodMap.set(a.periodId, []);
        }
        periodMap.get(a.periodId)!.push({ assignmentId: a.id, studentIds });
    }

    // For each assignment, count students who also appear in concurrent assignments
    const clashMap: Record<string, number> = {};

    for (const [, group] of periodMap) {
        for (const item of group) {
            let totalClashes = 0;
            for (const other of group) {
                if (other.assignmentId === item.assignmentId) continue;
                // Count intersection
                for (const sid of other.studentIds) {
                    if (item.studentIds.has(sid)) totalClashes++;
                }
            }
            clashMap[item.assignmentId] = totalClashes;
        }
    }

    // Also compute period-level clash counts
    const periodClashMap: Record<string, number> = {};
    for (const [periodId, group] of periodMap) {
        let total = 0;
        for (const item of group) {
            total += clashMap[item.assignmentId] ?? 0;
        }
        // Divide by 2 since each clash is counted from both sides
        periodClashMap[periodId] = Math.floor(total / 2);
    }

    return jsonResponse({ clashMap, periodClashMap });
});
