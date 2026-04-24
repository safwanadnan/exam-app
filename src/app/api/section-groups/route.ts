import { NextRequest, NextResponse } from "next/server";
import { prisma, jsonResponse, getPagination, getSearch, withErrorHandling } from "@/lib/api-helpers";

/**
 * GET /api/section-groups?sessionId=...
 *
 * instructorKey is stored as sorted original instructor names joined by "|".
 * We return them directly as instructorNames[].
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
    const { skip, limit, page } = getPagination(req);
    const search = getSearch(req);
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    const where: any = sessionId ? { course: { sessionId } } : {};
    
    if (search) {
        where.OR = [
            { course: { title: { contains: search } } },
            { course: { courseNumber: { contains: search } } },
            { instructorKey: { contains: search } },
        ];
    }

    const [groups, total] = await Promise.all([
        prisma.sectionGroup.findMany({
            where,
            skip,
            take: limit,
            include: {
                course: {
                    select: {
                        courseNumber: true,
                        title: true,
                        subject: { select: { code: true } }
                    }
                },
                members: {
                    include: {
                        section: {
                            select: {
                                sectionNumber: true,
                                _count: { select: { enrollments: true } }
                            }
                        }
                    }
                },
                _count: { select: { members: true } }
            },
            orderBy: [
                { course: { title: "asc" } },
                { instructorKey: "asc" }
            ]
        }),
        prisma.sectionGroup.count({ where }),
    ]);

    // instructorKey is the normalized (lowercased) names joined by "|"
    // Title-case each part for proper display
    const titleCase = (str: string) =>
        str
            .split(/\s+/)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");

    const enrichedGroups = groups.map(g => ({
        ...g,
        instructorNames: g.instructorKey === "__no_instructor__"
            ? ["No instructor assigned"]
            : g.instructorKey.split("|").map(name => titleCase(name)),
    }));

    return jsonResponse({ groups: enrichedGroups, total, page, limit });
});

/**
 * PATCH /api/section-groups
 * Bulk updates multiple section groups.
 */
export async function PATCH(request: Request) {
    try {
        const { ids, sameDayRequired } = await request.json();
        
        if (!Array.isArray(ids) || ids.length === 0 || typeof sameDayRequired !== "boolean") {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // Fetch first group to get course context for rebuild
        const firstGroup = await prisma.sectionGroup.findUnique({
            where: { id: ids[0] },
            include: { course: { select: { sessionId: true } } }
        });

        if (!firstGroup) {
            return NextResponse.json({ error: "No valid groups found" }, { status: 404 });
        }

        const { rebuildCourseClusterConstraints } = await import("@/lib/section-groups");

        let constraintsCreated = 0;
        await prisma.$transaction(async (tx) => {
            await tx.sectionGroup.updateMany({
                where: { id: { in: ids } },
                data: { sameDayRequired }
            });
            
            // Rebuild for the first group's course (assuming all IDs are from the same course cluster)
            constraintsCreated = await rebuildCourseClusterConstraints(tx, firstGroup.courseId, firstGroup.course.sessionId);
        });

        return NextResponse.json({ success: true, constraintsCreated });
    } catch (error) {
        console.error("Failed to bulk update section groups:", error);
        return NextResponse.json({ error: "Bulk update failed" }, { status: 500 });
    }
}
