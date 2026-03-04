export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma, jsonResponse, withErrorHandling } from "@/lib/api-helpers";

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
                            section: {
                                include: {
                                    course: true
                                }
                            }
                        }
                    },
                    instructorAssignments: {
                        include: {
                            instructor: true
                        }
                    },
                    studentEnrollments: {
                        select: { studentId: true }
                    }
                }
            },
            period: true,
            rooms: {
                include: {
                    room: {
                        include: {
                            building: true
                        }
                    }
                }
            }
        }
    });

    if (!assignment) {
        return jsonResponse({ error: "Assignment not found" }, 404);
    }

    // 2. Fetch all OTHER assignments in the exact SAME period and run to compute clashes
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
                        select: { studentId: true }
                    }
                }
            }
        }
    });

    // Extract this exam's student IDs into a Set for fast intersection
    const studentIds = new Set(assignment.exam.studentEnrollments.map(e => e.studentId));

    // 3. Compute direct clashes (students enrolled in THIS exam and ANOTHER concurrent exam)
    const clashes = concurrentAssignments.map(concurrent => {
        const concurrentStudentIds = concurrent.exam.studentEnrollments.map(e => e.studentId);
        const conflictingStudents = concurrentStudentIds.filter(id => studentIds.has(id));

        if (conflictingStudents.length > 0) {
            return {
                concurrentExamName: concurrent.exam.name || "Unnamed Exam",
                concurrentExamId: concurrent.exam.id,
                clashCount: conflictingStudents.length
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
            totalStudents: studentIds.size,
            courses: assignment.exam.owners.map(o => `${o.section.course.subjectId} ${o.section.course.courseNumber} - ${o.section.sectionNumber}`),
            instructors: assignment.exam.instructorAssignments.map(i => i.instructor.name),
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
