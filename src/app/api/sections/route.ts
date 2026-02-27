import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");

    try {
        const sections = await prisma.section.findMany({
            where: courseId ? { courseId } : undefined,
            include: { _count: { select: { enrollments: true, examOwners: true } } },
            orderBy: { sectionNumber: 'asc' }
        });
        return NextResponse.json({ sections });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch sections" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const section = await prisma.section.create({
            data: {
                sectionNumber: body.sectionNumber,
                courseId: body.courseId,
            }
        });
        return NextResponse.json({ section });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create section" }, { status: 500 });
    }
}
