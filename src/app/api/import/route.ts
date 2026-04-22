export const dynamic = 'force-dynamic';
/**
 * POST /api/import Bulk data import
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";
import { recomputeSectionGroups } from "@/lib/section-groups";

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
                // Upsert Building
                const building = await tx.building.upsert({
                    where: { code: b.code },
                    create: {
                        code: b.code,
                        name: b.name,
                    },
                    update: {
                        name: b.name,
                    }
                });

                // Handle Rooms individually for idempotency
                for (const r of b.rooms) {
                    await tx.room.upsert({
                        where: {
                            name_buildingId: {
                                name: r.name,
                                buildingId: building.id
                            }
                        },
                        create: {
                            name: r.name,
                            capacity: r.capacity,
                            altCapacity: r.altCapacity,
                            buildingId: building.id
                        },
                        update: {
                            capacity: r.capacity,
                            altCapacity: r.altCapacity
                        }
                    });
                    stats.rooms++;
                }
                stats.buildings++;
            }
        }

        // 3. Collect Unique Persons
        const uniqueStudents = new Map<string, { externalId: string; name: string }>();
        const uniqueInstructors = new Map<string, { externalId: string; name: string }>();

        if (data.examTypes) {
            for (const et of data.examTypes) {
                if (et.exams) {
                    for (const currExam of et.exams) {
                        if (currExam.students) {
                            for (const stu of currExam.students) {
                                uniqueStudents.set(stu.externalId, { externalId: stu.externalId, name: stu.name });
                            }
                        }
                        if (currExam.instructors) {
                            for (const ins of currExam.instructors) {
                                uniqueInstructors.set(ins.externalId, { externalId: ins.externalId, name: ins.name });
                            }
                        }
                    }
                }
            }
        }

        // 4. Bulk Upsert Persons
        const studentValues = Array.from(uniqueStudents.values());
        for (const s of studentValues) {
            await tx.student.upsert({
                where: { externalId: s.externalId },
                create: s,
                update: { name: s.name }
            });
        }

        const instructorValues = Array.from(uniqueInstructors.values());
        for (const i of instructorValues) {
            await tx.instructor.upsert({
                where: { externalId: i.externalId },
                create: i,
                update: { name: i.name }
            });
        }

        // Retrieve Person IDs Map
        const studentIdMap = new Map<string, string>();
        if (studentValues.length > 0) {
            const dbStudents = await tx.student.findMany({
                where: { externalId: { in: studentValues.map(s => s.externalId) } },
                select: { id: true, externalId: true }
            });
            for (const s of dbStudents) {
                studentIdMap.set(s.externalId, s.id);
            }
        }

        const instructorIdMap = new Map<string, string>();
        if (instructorValues.length > 0) {
            const dbInstructors = await tx.instructor.findMany({
                where: { externalId: { in: instructorValues.map(i => i.externalId) } },
                select: { id: true, externalId: true }
            });
            for (const i of dbInstructors) {
                instructorIdMap.set(i.externalId, i.id);
            }
        }

        // 5. Create Exam Types, Periods & Exams
        if (data.examTypes) {
            let defaultDeptId = "";
            let defaultSubjId = "";

            const bulkExams: any[] = [];
            const bulkExamOwners: any[] = [];
            const bulkInstructorAssignments: any[] = [];
            const bulkStudentEnrollments: any[] = [];

            for (const et of data.examTypes) {
                const examType = await tx.examType.upsert({
                    where: { code_sessionId: { code: et.code, sessionId: session.id } },
                    create: { name: et.name, code: et.code, sessionId: session.id },
                    update: { name: et.name }
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
                        let sectionId: string | undefined = undefined;

                        // Create courses safely
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

                        // Generate an ID for the Exam to link relations securely
                        const examId = crypto.randomUUID();

                        bulkExams.push({
                            id: examId,
                            name: currExam.name,
                            length: currExam.length,
                            size: currExam.size,
                            maxRooms: currExam.maxRooms,
                            altSeating: currExam.altSeating,
                            examTypeId: examType.id,
                        });

                        if (sectionId) {
                            bulkExamOwners.push({
                                examId: examId,
                                sectionId: sectionId
                            });
                        }

                        if (currExam.instructors) {
                            for (const ins of currExam.instructors) {
                                const id = instructorIdMap.get(ins.externalId);
                                if (id) {
                                    bulkInstructorAssignments.push({
                                        instructorId: id,
                                        examId: examId
                                    });
                                }
                            }
                        }

                        if (currExam.students && sectionId) {
                            for (const stu of currExam.students) {
                                const id = studentIdMap.get(stu.externalId);
                                if (id) {
                                    bulkStudentEnrollments.push({
                                        studentId: id,
                                        sectionId: sectionId,
                                        examId: examId
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // 6. Bulk Insert Exams and Relations
            if (bulkExams.length > 0) {
                await tx.exam.createMany({ data: bulkExams });
            }
            if (bulkExamOwners.length > 0) {
                await tx.examOwner.createMany({ data: bulkExamOwners });
            }
            if (bulkInstructorAssignments.length > 0) {
                // Ignore duplicates if for some reason an instructor is assigned twice to the same exam
                await tx.instructorAssignment.createMany({ data: bulkInstructorAssignments });
            }
            if (bulkStudentEnrollments.length > 0) {
                await tx.studentEnrollment.createMany({ data: bulkStudentEnrollments });
            }
        }

        return { sessionId: session.id, stats };
    }, {
        timeout: 6000000 // Allow up to 60s for massive structural imports
    });

    const sectionGroups = await recomputeSectionGroups(prisma, result.sessionId);

    return jsonResponse(
        {
            success: true,
            message: "Import completed successfully",
            result,
            sectionGroups,
        },
        201
    );
});
