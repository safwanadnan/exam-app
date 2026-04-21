import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/section-groups/recompute?sessionId=...
 *
 * Grouping rules:
 *  - Same course TITLE + same teacher(s) → ONE Section Group
 *  - Same course title but different teacher → separate Section Group
 *
 * Always starts fresh: deletes stale groups + DistributionConstraints, then recomputes.
 */
export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    try {
        // ── Load all exams for the session ──────────────────────────────────
        const dbExams = await prisma.exam.findMany({
            where: { examType: { sessionId } },
            include: {
                owners: {
                    include: {
                        section: {
                            include: {
                                course: {
                                    select: { id: true, courseNumber: true, title: true, sessionId: true }
                                }
                            }
                        }
                    }
                },
                instructorAssignments: {
                    include: {
                        instructor: { select: { externalId: true, name: true } }
                    }
                }
            }
        });

        const totalExams = dbExams.length;
        const sessionExamIds = dbExams.map(e => e.id);

        // ── Clean slate ─────────────────────────────────────────────────────
        const existingGroups = await prisma.sectionGroup.findMany({
            where: { course: { sessionId } },
            select: { id: true }
        });
        
        if (existingGroups.length > 0) {
            await prisma.sectionGroup.deleteMany({
                where: { id: { in: existingGroups.map(g => g.id) } }
            });
        }

        if (sessionExamIds.length > 0) {
            // Delete old SAME_DAY and SAME_PERIOD constraints for this session
            await prisma.distributionConstraint.deleteMany({
                where: {
                    type: { in: ["SAME_DAY", "SAME_PERIOD"] },
                    hard: true,
                    examAId: { in: sessionExamIds },
                    examBId: { in: sessionExamIds },
                }
            });
        }

        // ── Build groups by Title ───────────────────────────────────────────
        
        const norm = (s: string) =>
            s
                .replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u2000-\u200F\u2028\u2029]/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();

        const titleToCanonicalCourseId = new Map<string, string>();

        type GroupEntry = {
            canonicalCourseId: string;
            courseTitle: string;
            instructorKey: string;
            instructorNames: string[];
            examIds: string[];
            sectionIds: string[];
        };
        const groupMap = new Map<string, GroupEntry>();

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

                const instructors = exam.instructorAssignments.map(a => ({
                    externalId: a.instructor.externalId,
                    name: a.instructor.name,
                }));

                const sortedNormNames = instructors.map(i => norm(i.name)).sort();
                const instructorKey = sortedNormNames.length > 0 ? sortedNormNames.join("|") : "__no_instructor__";
                const groupKey = `${normalizedTitle}::${sessionId}::${instructorKey}`;

                if (!groupMap.has(groupKey)) {
                    const sortedOriginalNames = instructors
                        .slice()
                        .sort((a, b) => norm(a.name).localeCompare(norm(b.name)))
                        .map(i => i.name.trim());

                    groupMap.set(groupKey, {
                        canonicalCourseId,
                        courseTitle: course.title,
                        instructorKey,
                        instructorNames: sortedOriginalNames.length > 0 ? sortedOriginalNames : ["No instructor assigned"],
                        examIds: [],
                        sectionIds: [],
                    });
                }

                const entry = groupMap.get(groupKey)!;
                if (!entry.examIds.includes(exam.id)) entry.examIds.push(exam.id);
                if (!entry.sectionIds.includes(owner.sectionId)) entry.sectionIds.push(owner.sectionId);
            }
        }

        // ── Persist groups and constraints ──────────────────────────────────
        let groupsCreated = 0;
        let constraintsCreated = 0;

        // Map: canonicalCourseId -> array of { group, examIds, isActive }
        const courseClusters = new Map<string, { group: any; examIds: string[]; active: boolean }[]>();

        await prisma.$transaction(async (tx) => {
            // 1. Create all SectionGroups
            for (const [, entry] of groupMap.entries()) {
                const sectionGroup = await tx.sectionGroup.create({
                    data: {
                        courseId: entry.canonicalCourseId,
                        instructorKey: entry.instructorKey,
                        sameDayRequired: true, // Default to synced for now
                    }
                });
                groupsCreated++;

                for (const sectionId of entry.sectionIds) {
                    await tx.sectionGroupMember.create({
                        data: { sectionGroupId: sectionGroup.id, sectionId }
                    });
                }

                if (!courseClusters.has(entry.canonicalCourseId)) {
                    courseClusters.set(entry.canonicalCourseId, []);
                }
                courseClusters.get(entry.canonicalCourseId)!.push({
                    group: sectionGroup,
                    examIds: entry.examIds,
                    active: true // Since we defaulted sameDayRequired to true
                });
            }

            // 2. Generate Binary Constraints (Hard SAME_PERIOD)
            const allConstraints: any[] = [];
            const constraintKeys = new Set<string>();

            const addConstraint = (type: string, aId: string, bId: string) => {
                // Always order IDs so A-B and B-A are the same key
                const [first, second] = aId < bId ? [aId, bId] : [bId, aId];
                const key = `${type}:${first}:${second}`;
                if (constraintKeys.has(key)) return;
                
                constraintKeys.add(key);
                allConstraints.push({
                    type,
                    hard: true,
                    weight: 1,
                    examAId: first,
                    examBId: second,
                });
            };

            for (const [courseId, clusters] of courseClusters.entries()) {
                // Mandatory Intra-Group: internal to each teacher
                for (const cluster of clusters) {
                    const ids = cluster.examIds;
                    for (let i = 0; i < ids.length; i++) {
                        for (let j = i + 1; j < ids.length; j++) {
                            addConstraint("SAME_PERIOD", ids[i], ids[j]);
                        }
                    }
                }

                // Conditional Inter-Group: between different teachers of the same course
                const activeExamIds = clusters
                    .filter(c => c.active)
                    .flatMap(c => c.examIds);

                for (let i = 0; i < clusters.length; i++) {
                    if (!clusters[i].active) continue;
                    for (let j = i + 1; j < clusters.length; j++) {
                        if (!clusters[j].active) continue;
                        
                        for (const examA of clusters[i].examIds) {
                            for (const examB of clusters[j].examIds) {
                                addConstraint("SAME_PERIOD", examA, examB);
                            }
                        }
                    }
                }
            }

            if (allConstraints.length > 0) {
                await tx.distributionConstraint.createMany({ 
                    data: allConstraints,
                    // No skipDuplicates because we might have overlap if different teachers share an exam
                    // Actually, let's just make it distinct at the JS level to be safe
                });
                constraintsCreated = allConstraints.length;
            }
        }, { timeout: 300000 });

        return NextResponse.json({
            success: true,
            groupsCreated,
            constraintsCreated,
            message: `Created ${groupsCreated} section groups with hierarchical SAME_PERIOD constraints.`
        });

    } catch (error) {
        console.error("Failed to recompute section groups:", error);
        return NextResponse.json({ error: "Failed to recompute section groups" }, { status: 500 });
    }
}
