export const dynamic = 'force-dynamic';
/**
 * POST /api/import â€” Bulk data import
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

// Simplified schema for the bulk import payload
const importSchema = z.object({
    session: z.object({
        name: z.string(),
        year: z.number().int(),
        term: z.string(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
    }),
    buildings: z.array(z.object({
        code: z.string(),
        name: z.string(),
        rooms: z.array(z.object({
            name: z.string(),
            capacity: z.number().int(),
            altCapacity: z.number().int().optional(),
        }))
    })).optional(),
    examTypes: z.array(z.object({
        name: z.string(),
        code: z.string(),
        periods: z.array(z.object({
            date: z.string().datetime(),
            startTime: z.string(),
            endTime: z.string(),
            length: z.number().int(),
            day: z.number().int(),
            timeIndex: z.number().int(),
            penalty: z.number().int().default(0),
        })),
        exams: z.array(z.object({
            name: z.string().optional(),
            length: z.number().int(),
            size: z.number().int(),
            maxRooms: z.number().int().default(4),
            altSeating: z.boolean().default(false),
            courseCode: z.string().optional(),
            courseTitle: z.string().optional(),
            sectionNumber: z.string().optional(),
            instructors: z.array(z.object({
                externalId: z.string(),
                name: z.string(),
            })).optional(),
            students: z.array(z.object({
                externalId: z.string(),
                name: z.string(),
            })).optional()
        })).optional()
    })).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, importSchema);
    if (parsed.error) return parsed.error;

    const data = parsed.data;

    // Use a transaction for bulk import
    const result = await prisma.$transaction(async (tx: any) => {
        // 1. Create Session
        const session = await tx.academicSession.create({
            data: {
                ...data.session,
                startDate: new Date(data.session.startDate),
                endDate: new Date(data.session.endDate),
            }
        });

        const stats = { buildings: 0, rooms: 0, examTypes: 0, periods: 0, exams: 0 };

        // 2. Create Buildings & Rooms
        if (data.buildings) {
            for (const b of data.buildings) {
                await tx.building.create({
                    data: {
                        code: b.code,
                        name: b.name,
                        rooms: {
                            create: b.rooms.map(r => ({
                                name: r.name,
                                capacity: r.capacity,
                                altCapacity: r.altCapacity,
                            }))
                        }
                    }
                });
                stats.buildings++;
                stats.rooms += b.rooms.length;
            }
        }

        // 3. Create Exam Types, Periods & Exams
        if (data.examTypes) {
            let defaultDeptId = "";
            let defaultSubjId = "";

            for (const et of data.examTypes) {
                const examType = await tx.examType.upsert({
                    where: { code_sessionId: { code: et.code, sessionId: session.id } },
                    create: {
                        name: et.name,
                        code: et.code,
                        sessionId: session.id,
                    },
                    update: {
                        name: et.name,
                    }
                });

                // Import periods safely with Upsert
                for (const p of et.periods) {
                    await tx.examPeriod.upsert({
                        where: {
                            date_startTime_examTypeId: {
                                date: new Date(p.date),
                                startTime: p.startTime,
                                examTypeId: examType.id
                            }
                        },
                        create: {
                            ...p,
                            date: new Date(p.date),
                            examTypeId: examType.id
                        },
                        update: {
                            endTime: p.endTime,
                            length: p.length,
                            day: p.day,
                            timeIndex: p.timeIndex,
                            penalty: p.penalty
                        }
                    });
                }
                stats.examTypes++;
                stats.periods += et.periods.length;
                stats.exams += et.exams?.length || 0;

                if (et.exams) {
                    for (const currExam of et.exams) {
                        // Handle Course/Section
                        let sectionId: string | undefined = undefined;
                        if (currExam.courseCode) {
                            if (!defaultDeptId) {
                                const dept = await tx.department.upsert({
                                    where: { code_sessionId: { code: "GEN", sessionId: session.id } },
                                    create: { code: "GEN", name: "General Dept", sessionId: session.id },
                                    update: {}
                                });
                                defaultDeptId = dept.id;
                                const subj = await tx.subject.upsert({
                                    where: { code_departmentId: { code: "GEN", departmentId: dept.id } },
                                    create: { code: "GEN", name: "General Subject", departmentId: dept.id },
                                    update: {}
                                });
                                defaultSubjId = subj.id;
                            }

                            const course = await tx.course.upsert({
                                where: { courseNumber_subjectId_sessionId: { courseNumber: currExam.courseCode, subjectId: defaultSubjId, sessionId: session.id } },
                                create: { courseNumber: currExam.courseCode, title: currExam.courseTitle || currExam.courseCode, subjectId: defaultSubjId, sessionId: session.id },
                                update: {}
                            });

                            const section = await tx.section.upsert({
                                where: { sectionNumber_courseId: { sectionNumber: currExam.sectionNumber || "001", courseId: course.id } },
                                create: { sectionNumber: currExam.sectionNumber || "001", courseId: course.id },
                                update: {}
                            });
                            sectionId = section.id;
                        }

                        // Create the Exam
                        const exam = await tx.exam.create({
                            data: {
                                name: currExam.name,
                                length: currExam.length,
                                size: currExam.size,
                                maxRooms: currExam.maxRooms,
                                altSeating: currExam.altSeating,
                                examTypeId: examType.id,
                                owners: sectionId ? {
                                    create: [{ sectionId }]
                                } : undefined
                            }
                        });

                        // Create Instructors
                        if (currExam.instructors) {
                            for (const ins of currExam.instructors) {
                                const instructor = await tx.instructor.upsert({
                                    where: { externalId: ins.externalId },
                                    create: { externalId: ins.externalId, name: ins.name },
                                    update: {}
                                });
                                await tx.instructorAssignment.create({
                                    data: { instructorId: instructor.id, examId: exam.id }
                                });
                            }
                        }

                        // Create Students & Enrollments
                        if (currExam.students && sectionId) {
                            for (const stu of currExam.students) {
                                const student = await tx.student.upsert({
                                    where: { externalId: stu.externalId },
                                    create: { externalId: stu.externalId, name: stu.name },
                                    update: {}
                                });
                                await tx.studentEnrollment.create({
                                    data: { studentId: student.id, sectionId: sectionId, examId: exam.id }
                                });
                            }
                        }
                    }
                }
            }
        }

        return { sessionId: session.id, stats };
    }, {
        timeout: 30000 // Allow up to 30s for complex imports
    });

    return jsonResponse({ success: true, message: "Import completed successfully", result }, 201);
});

