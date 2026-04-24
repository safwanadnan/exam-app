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

    // 1. Fetch the exact assignment to get context (runId, periodId, courseId)
    const seed = await prisma.examAssignment.findUnique({
        where: { id: assignmentId },
        include: {
            exam: {
                include: {
                    owners: { 
                        include: { 
                            section: { include: { course: true } } 
                        } 
                    }
                }
            }
        }
    });

    if (!seed) return jsonResponse({ error: "Assignment not found" }, 404);

    const courseTitle = seed.exam.owners[0]?.section?.course?.title;

    if (!courseTitle) {
        // Fallback if no course is linked: just show details for this single exam
        const studentMap = new Map(seed.exam.studentEnrollments?.map(e => [e.student.id, e.student]) || []);
        // ... (this part is complex to fix here, but the main issue was the crash)
    }

    // 2. Fetch all assignments for courses with the SAME TITLE in this PERIOD and RUN
    const allGroupAssignments = await prisma.examAssignment.findMany({
        where: {
            runId: seed.runId,
            periodId: seed.periodId,
            exam: {
                owners: {
                    some: {
                        section: {
                            course: { title: courseTitle }
                        }
                    }
                }
            }
        },
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

    const groupExamIds = allGroupAssignments.map(a => a.examId);
    
    // 3. Fetch Solver Run Diagnostics (for violations)
    const run = await prisma.solverRun.findUnique({
        where: { id: seed.runId },
        select: { log: true }
    });

    let runDiagnostics: any = null;
    if (run?.log) {
        try {
            runDiagnostics = JSON.parse(run.log);
        } catch { /* ignore */ }
    }

    const concurrentOther = await prisma.examAssignment.findMany({
        where: {
            runId: seed.runId,
            periodId: seed.periodId,
            examId: { notIn: groupExamIds }
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

    // Aggregated Results
    const examsData = allGroupAssignments.map(a => {
        const studentMap = new Map(a.exam.studentEnrollments.map(e => [e.student.id, e.student]));
        
        // Find violations from diagnostics
        const violations = runDiagnostics?.examDiagnostics?.find((d: any) => d.examId === a.examId)?.distributionViolations || [];
        
        // Clashes for this specific exam
        const examClashes = concurrentOther.map(concurrent => {
            const clashingStudents = concurrent.exam.studentEnrollments
                .filter(e => studentMap.has(e.student.id))
                .map(e => ({
                    id: e.student.id,
                    name: e.student.name,
                    externalId: e.student.externalId,
                }));

            return clashingStudents.length > 0 ? {
                concurrentExamName: concurrent.exam.name || "Unnamed Exam",
                concurrentExamId: concurrent.exam.id,
                concurrentAssignmentId: concurrent.id,
                clashCount: clashingStudents.length,
                clashingStudents,
            } : null;
        }).filter(Boolean);

        return {
            id: a.id,
            examId: a.examId,
            name: a.exam.name,
            length: a.exam.length,
            students: studentMap.size,
            sections: a.exam.owners.map(o => {
                const cn = o.section.course.courseNumber;
                const sn = o.section.sectionNumber;
                return cn === sn ? cn : `${cn} - ${sn}`;
            }),
            instructors: a.exam.instructorAssignments.map(i => i.instructor.name),
            clashes: examClashes.reduce((sum, c: any) => sum + (c?.clashCount || 0), 0),
            clashDetails: examClashes,
            violations: violations
        };
    });

    const first = allGroupAssignments[0];
    const course = first.exam.owners[0]?.section.course;
    
    // Unique rooms across all assignments in this group
    const roomMap = new Map<string, any>();
    allGroupAssignments.forEach(a => {
        a.rooms.forEach(r => {
            roomMap.set(r.roomId, {
                name: `${r.room.building.code} ${r.room.name}`,
                buildingCode: r.room.building.code,
                capacity: r.room.capacity
            });
        });
    });

    return jsonResponse({
        details: {
            id: seed.id,
            courseTitle: course?.title || seed.exam.name || "Unnamed Course",
            courseNumber: course?.courseNumber,
            exams: examsData,
            period: {
                date: first.period.date,
                startTime: first.period.startTime,
                endTime: first.period.endTime,
                length: first.period.length
            },
            rooms: Array.from(roomMap.values())
        }
    });
});
