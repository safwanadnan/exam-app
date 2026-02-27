import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId");
    const sessionId = searchParams.get("sessionId");

    try {
        const where: any = {};
        if (subjectId) where.subjectId = subjectId;
        if (sessionId) where.sessionId = sessionId;

        const courses = await prisma.course.findMany({
            where,
            include: { _count: { select: { sections: true } } },
            orderBy: { courseNumber: 'asc' }
        });
        return NextResponse.json({ courses });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const course = await prisma.course.create({
            data: {
                courseNumber: body.courseNumber,
                title: body.title,
                subjectId: body.subjectId,
                sessionId: body.sessionId,
            }
        });
        return NextResponse.json({ course });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
    }
}
