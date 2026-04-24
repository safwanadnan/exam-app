export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { prisma, jsonResponse, withErrorHandling } from "@/lib/api-helpers";

export const GET = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const runId = url.searchParams.get("runId");

    // Base stats
    const [examCount, studentCount, roomCount, periodCount] = await Promise.all([
        prisma.exam.count(),
        prisma.student.count(),
        prisma.room.count(),
        prisma.examPeriod.count(),
    ]);

    const result: any = {
        overview: { exams: examCount, students: studentCount, rooms: roomCount, periods: periodCount },
        conflicts: [],
        roomUtilization: [],
        periodUtilization: [],
    };

    if (runId) {
        // Get all assignments for this run with student enrollment info
        const assignments = await prisma.examAssignment.findMany({
            where: { runId },
            include: {
                exam: {
                    select: {
                        id: true, name: true, length: true,
                        studentEnrollments: { select: { student: { select: { id: true, name: true, externalId: true } } } },
                        owners: {
                            select: {
                                section: {
                                    select: {
                                        course: { select: { title: true, courseNumber: true } }
                                    }
                                }
                            }
                        }
                    },
                },
                period: { select: { id: true, date: true, startTime: true, endTime: true, length: true } },
                rooms: { include: { room: { select: { id: true, name: true, capacity: true, building: { select: { code: true } } } } } },
            },
        });

        // Detect student conflicts: students with 2+ exams in same period
        // Store the full student objects for reference
        const periodStudentMap = new Map<string, { examId: string; examName: string; courseName: string; students: {id: string, name: string, externalId: string}[] }[]>();
        for (const a of assignments) {
            const pid = a.period.id;
            if (!periodStudentMap.has(pid)) periodStudentMap.set(pid, []);
            
            let courseName = a.exam.name || "Unnamed";
            if (a.exam.owners && a.exam.owners.length > 0 && a.exam.owners[0].section?.course) {
                 courseName = `${a.exam.owners[0].section.course.courseNumber} - ${a.exam.owners[0].section.course.title}`;
            }

            periodStudentMap.get(pid)!.push({
                examId: a.exam.id,
                examName: a.exam.name || "Unnamed",
                courseName: courseName,
                students: a.exam.studentEnrollments.map(e => e.student),
            });
        }

        const conflicts: any[] = [];
        for (const [periodId, periodExams] of periodStudentMap) {
            for (let i = 0; i < periodExams.length; i++) {
                for (let j = i + 1; j < periodExams.length; j++) {
                    const examAStudents = periodExams[i].students;
                    const examBStudents = periodExams[j].students;
                    
                    const sharedStudents = examAStudents.filter(sA => examBStudents.some(sB => sB.id === sA.id));
                    
                    if (sharedStudents.length > 0) {
                        const period = assignments.find(a => a.period.id === periodId)!.period;
                        conflicts.push({
                            periodId,
                            periodDate: period.date,
                            periodTime: `${period.startTime}-${period.endTime}`,
                            examA: { id: periodExams[i].examId, name: periodExams[i].examName, courseName: periodExams[i].courseName },
                            examB: { id: periodExams[j].examId, name: periodExams[j].examName, courseName: periodExams[j].courseName },
                            sharedStudents: sharedStudents.length,
                            students: sharedStudents,
                        });
                    }
                }
            }
        }
        result.conflicts = conflicts.sort((a, b) => b.sharedStudents - a.sharedStudents);

        // Room utilization
        const roomUsage = new Map<string, { name: string; building: string; capacity: number; usedSlots: number; totalStudents: number }>();
        for (const a of assignments) {
            for (const ar of a.rooms) {
                const rid = ar.room.id;
                if (!roomUsage.has(rid)) {
                    roomUsage.set(rid, {
                        name: ar.room.name,
                        building: ar.room.building.code,
                        capacity: ar.room.capacity,
                        usedSlots: 0,
                        totalStudents: 0,
                    });
                }
                roomUsage.get(rid)!.usedSlots++;
                roomUsage.get(rid)!.totalStudents += a.exam.studentEnrollments.length;
            }
        }
        result.roomUtilization = Array.from(roomUsage.values()).sort((a, b) => b.usedSlots - a.usedSlots);

        // Period utilization
        const periodUsage = new Map<string, { date: string; time: string; examCount: number; studentCount: number }>();
        for (const a of assignments) {
            const pid = a.period.id;
            if (!periodUsage.has(pid)) {
                periodUsage.set(pid, {
                    date: typeof a.period.date === 'string' ? a.period.date : (a.period.date as Date).toISOString(),
                    time: `${a.period.startTime}-${a.period.endTime}`,
                    examCount: 0,
                    studentCount: 0,
                });
            }
            periodUsage.get(pid)!.examCount++;
            periodUsage.get(pid)!.studentCount += a.exam.studentEnrollments.length;
        }
        result.periodUtilization = Array.from(periodUsage.values());
        result.assignmentCount = assignments.length;
    }

    return jsonResponse(result);
});
