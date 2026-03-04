export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { prisma, jsonResponse, withErrorHandling } from "@/lib/api-helpers";

/**
 * GET /api/schedule/details?assignmentId=…
 * Returns deep exam details + clashing student names.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const assignmentId = url.searchParams.get("assignmentId");

    if (!assignmentId) {
        return jsonResponse({ error: "assignmentId is required" }, 400);
    }

    // 1. Fetch the exact assignment with deep population
    const assignment = await prisma.examAssignment.findUnique({
        where: { id: assignmentId },
        include: {
            exam: {
                include: {
                    owners: {
                        include: {
                            section: { include: { course: true } }
                        }
                    },
                    instructorAssignments: {
                        include: { instructor: true }
                    },
                    studentEnrollments: {
                        include: {
                            student: { select: { id: true, name: true, externalId: true } }
                        }
                    }
                }
            },
            period: true,
            rooms: {
                include: {
                    room: { include: { building: true } }
                }
            }
        }
    });

    if (!assignment) {
        return jsonResponse({ error: "Assignment not found" }, 404);
    }

    // 2. Fetch all OTHER assignments in the exact SAME period and run
    const concurrentAssignments = await prisma.examAssignment.findMany({
        where: {
            runId: assignment.runId,
            periodId: assignment.periodId,
            id: { not: assignmentId }
        },
        include: {
            exam: {
                include: {
                    studentEnrollments: {
                        include: {
                            student: { select: { id: true, name: true, externalId: true } }
                        }
                    }
                }
            }
        }
    });

    // Build a map of studentId → student info for this exam
    const thisExamStudents = new Map(
        assignment.exam.studentEnrollments.map(e => [e.student.id, e.student])
    );

    // 3. Compute clashes with student names
    const clashes = concurrentAssignments.map(concurrent => {
        const clashingStudents = concurrent.exam.studentEnrollments
            .filter(e => thisExamStudents.has(e.student.id))
            .map(e => ({
                id: e.student.id,
                name: e.student.name,
                externalId: e.student.externalId,
            }));

        if (clashingStudents.length > 0) {
            return {
                concurrentExamName: concurrent.exam.name || "Unnamed Exam",
                concurrentExamId: concurrent.exam.id,
                concurrentAssignmentId: concurrent.id,
                clashCount: clashingStudents.length,
                clashingStudents,
            };
        }
        return null;
    }).filter(Boolean);

    // 4. Return formatted data
    return jsonResponse({
        details: {
            id: assignment.id,
            examName: assignment.exam.name,
            examLength: assignment.exam.length,
            totalStudents: thisExamStudents.size,
            courses: assignment.exam.owners.map(o =>
                `${o.section.course.subjectId} ${o.section.course.courseNumber} - ${o.section.sectionNumber}`
            ),
            instructors: assignment.exam.instructorAssignments.map(i => i.instructor.name),
            students: Array.from(thisExamStudents.values()).map(s => ({
                id: s.id, name: s.name, externalId: s.externalId
            })),
            period: {
                date: assignment.period.date,
                startTime: assignment.period.startTime,
                endTime: assignment.period.endTime
            },
            rooms: assignment.rooms.map(r => ({
                name: `${r.room.building.code} ${r.room.name}`,
                capacity: r.room.capacity
            }))
        },
        clashes
    });
});
