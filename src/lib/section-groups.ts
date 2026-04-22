import { Prisma, type PrismaClient } from "../../generated/prisma/client";

type GroupSeed = {
    courseId: string;
    instructorKey: string;
    sectionIds: string[];
    examIds: string[];
};

type ConstraintRow = {
    type: "SAME_PERIOD";
    hard: boolean;
    weight: number;
    examAId: string;
    examBId: string;
};

const norm = (s: string) =>
    s
        .replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u2000-\u200F\u2028\u2029]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

function buildSamePeriodConstraints(
    groups: Array<{
        examIds: string[];
        sameDayRequired: boolean;
        sameInstructorSyncRequired: boolean;
    }>
): ConstraintRow[] {
    const out: ConstraintRow[] = [];
    const keys = new Set<string>();

    const addConstraint = (a: string, b: string) => {
        if (a === b) return;
        const [first, second] = a < b ? [a, b] : [b, a];
        const key = `SAME_PERIOD:${first}:${second}`;
        if (keys.has(key)) return;
        keys.add(key);
        out.push({
            type: "SAME_PERIOD",
            hard: true,
            weight: 1,
            examAId: first,
            examBId: second,
        });
    };

    // Default ON: same-instructor classes stay together unless explicitly separated.
    for (const group of groups) {
        if (!group.sameInstructorSyncRequired) continue;
        for (let i = 0; i < group.examIds.length; i++) {
            for (let j = i + 1; j < group.examIds.length; j++) {
                addConstraint(group.examIds[i], group.examIds[j]);
            }
        }
    }

    // Default OFF: different instructors of the same course stay independent unless both are synced.
    for (let i = 0; i < groups.length; i++) {
        if (!groups[i].sameDayRequired) continue;
        for (let j = i + 1; j < groups.length; j++) {
            if (!groups[j].sameDayRequired) continue;
            for (const examA of groups[i].examIds) {
                for (const examB of groups[j].examIds) {
                    addConstraint(examA, examB);
                }
            }
        }
    }

    return out;
}

async function rebuildSessionConstraints(
    tx: Prisma.TransactionClient,
    sessionId: string,
    courseIds: string[]
): Promise<number> {
    if (courseIds.length === 0) return 0;

    const sessionExams = await tx.exam.findMany({
        where: { examType: { sessionId } },
        select: { id: true },
    });
    const sessionExamIds = sessionExams.map((e) => e.id);

    if (sessionExamIds.length > 0) {
        await tx.distributionConstraint.deleteMany({
            where: {
                type: { in: ["SAME_PERIOD", "SAME_DAY"] },
                hard: true,
                examAId: { in: sessionExamIds },
                examBId: { in: sessionExamIds },
            },
        });
    }

    const allGroups = await tx.sectionGroup.findMany({
        where: { courseId: { in: courseIds } },
        include: {
            members: {
                include: {
                    section: {
                        include: {
                            examOwners: { select: { examId: true } },
                        },
                    },
                },
            },
        },
    });

    const byCourse = new Map<string, typeof allGroups>();
    for (const group of allGroups) {
        if (!byCourse.has(group.courseId)) byCourse.set(group.courseId, []);
        byCourse.get(group.courseId)!.push(group);
    }

    const rows: ConstraintRow[] = [];
    for (const groups of byCourse.values()) {
        const constraints = buildSamePeriodConstraints(
            groups.map((g) => ({
                examIds: unique(g.members.flatMap((m) => m.section.examOwners.map((o) => o.examId))),
                sameDayRequired: g.sameDayRequired,
                sameInstructorSyncRequired: g.sameInstructorSyncRequired,
            }))
        );
        rows.push(...constraints);
    }

    if (rows.length > 0) {
        await tx.distributionConstraint.createMany({ data: rows });
    }

    return rows.length;
}

export async function recomputeSectionGroups(
    prisma: PrismaClient | Prisma.TransactionClient,
    sessionId: string
): Promise<{ groupsCreated: number; constraintsCreated: number; message: string }> {
    const dbExams = await prisma.exam.findMany({
        where: { examType: { sessionId } },
        include: {
            owners: {
                include: {
                    section: {
                        include: {
                            course: {
                                select: { id: true, title: true, sessionId: true },
                            },
                        },
                    },
                },
            },
            instructorAssignments: {
                include: {
                    instructor: { select: { name: true } },
                },
            },
        },
    });

    const titleToCanonicalCourseId = new Map<string, string>();
    const groupMap = new Map<string, GroupSeed>();

    for (const exam of dbExams) {
        for (const owner of exam.owners) {
            const course = owner.section.course;
            if (course.sessionId !== sessionId) continue;

            const normalizedTitle = norm(course.title);
            const titleCacheKey = `${normalizedTitle}::${sessionId}`;
            if (!titleToCanonicalCourseId.has(titleCacheKey)) {
                titleToCanonicalCourseId.set(titleCacheKey, course.id);
            }
            const canonicalCourseId = titleToCanonicalCourseId.get(titleCacheKey)!;

            const sortedNormNames = exam.instructorAssignments
                .map((a) => norm(a.instructor.name))
                .sort();
            const instructorKey = sortedNormNames.length > 0 ? sortedNormNames.join("|") : "__no_instructor__";
            const groupKey = `${titleCacheKey}::${instructorKey}`;

            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, {
                    courseId: canonicalCourseId,
                    instructorKey,
                    sectionIds: [],
                    examIds: [],
                });
            }

            const group = groupMap.get(groupKey)!;
            if (!group.sectionIds.includes(owner.sectionId)) group.sectionIds.push(owner.sectionId);
            if (!group.examIds.includes(exam.id)) group.examIds.push(exam.id);
        }
    }

    const existingGroups = await prisma.sectionGroup.findMany({
        where: { course: { sessionId } },
        select: { id: true },
    });

    let groupsCreated = 0;
    let constraintsCreated = 0;

    await prisma.$transaction(async (tx) => {
        if (existingGroups.length > 0) {
            await tx.sectionGroup.deleteMany({
                where: { id: { in: existingGroups.map((g) => g.id) } },
            });
        }

        for (const [, seed] of groupMap.entries()) {
            const sectionGroup = await tx.sectionGroup.create({
                data: {
                    courseId: seed.courseId,
                    instructorKey: seed.instructorKey,
                    sameInstructorSyncRequired: true,
                    sameDayRequired: false,
                },
            });
            groupsCreated++;

            for (const sectionId of seed.sectionIds) {
                await tx.sectionGroupMember.create({
                    data: {
                        sectionGroupId: sectionGroup.id,
                        sectionId,
                    },
                });
            }
        }

        constraintsCreated = await rebuildSessionConstraints(tx, sessionId, unique(Array.from(groupMap.values()).map((g) => g.courseId)));
    }, { timeout: 300000 });

    return {
        groupsCreated,
        constraintsCreated,
        message: "Section groups recomputed with default instructor-level sync and optional course-level sync.",
    };
}

export async function rebuildCourseClusterConstraints(
    tx: Prisma.TransactionClient,
    courseId: string,
    sessionId: string
): Promise<number> {
    return rebuildSessionConstraints(tx, sessionId, [courseId]);
}