import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId");
    const sessionId = searchParams.get("sessionId");

    try {
        const where: Prisma.CourseWhereInput = {};
        if (subjectId) where.subjectId = subjectId;
        if (sessionId) where.sessionId = sessionId;

        const courses = await prisma.course.findMany({
            where,
            include: {
                _count: { select: { sections: true } },
                campus: { select: { id: true, code: true, name: true } },
            },
            orderBy: { courseNumber: 'asc' }
        });
        return NextResponse.json({ courses });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const raw = await request.json().catch(() => null) as unknown;
        if (!raw || typeof raw !== "object") {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }
        const body = raw as Record<string, unknown>;
        if (typeof body.courseNumber !== "string" || typeof body.title !== "string" || typeof body.subjectId !== "string" || typeof body.sessionId !== "string") {
            return NextResponse.json({ error: "Missing or invalid course fields" }, { status: 400 });
        }

        const course = await prisma.course.create({
            data: {
                courseNumber: String(body.courseNumber),
                title: String(body.title),
                subjectId: String(body.subjectId),
                sessionId: String(body.sessionId),
                campusId: body.campusId && typeof body.campusId === "string" ? body.campusId : null,
            },
            include: {
                campus: { select: { id: true, code: true, name: true } },
            },
        });
        return NextResponse.json({ course });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
    }
}
