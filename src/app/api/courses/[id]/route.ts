import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const course = await prisma.course.findUnique({
            where: { id },
            include: {
                campus: { select: { id: true, code: true, name: true } },
                _count: { select: { sections: true } },
            },
        });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ course });
    } catch {
        return NextResponse.json({ error: "Failed to fetch course" }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const raw = await request.json().catch(() => null) as unknown;
        if (!raw || typeof raw !== "object") {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }
        const body = raw as Record<string, unknown>;

        const updateData: Record<string, unknown> = {};
        if ("campusId" in body) {
            updateData.campusId = typeof body.campusId === "string" ? body.campusId : null;
        }
        if ("title" in body && typeof body.title === "string") updateData.title = body.title;
        if ("courseNumber" in body && typeof body.courseNumber === "string") updateData.courseNumber = body.courseNumber;

        const course = await prisma.course.update({
            where: { id },
            data: updateData as unknown as Prisma.CourseUpdateInput,
            include: {
                campus: { select: { id: true, code: true, name: true } },
            },
        });
        return NextResponse.json({ course });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        await prisma.course.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
    }
}
