import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/section-groups?sessionId=...
 *
 * instructorKey is stored as sorted original instructor names joined by "|".
 * We return them directly as instructorNames[].
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    try {
        const groups = await prisma.sectionGroup.findMany({
            where: sessionId ? { course: { sessionId } } : undefined,
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
        });

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

        return NextResponse.json({ groups: enrichedGroups });
    } catch (error) {
        console.error("Failed to fetch section groups:", error);
        return NextResponse.json({ error: "Failed to fetch section groups" }, { status: 500 });
    }
}
