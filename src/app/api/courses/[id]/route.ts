import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
        const body = await request.json();
        const data: any = {};

        // Allow updating campusId (pass null to clear it)
        if ("campusId" in body) {
            data.campusId = body.campusId ?? null;
        }
        if ("title" in body) data.title = body.title;
        if ("courseNumber" in body) data.courseNumber = body.courseNumber;

        const course = await prisma.course.update({
            where: { id },
            data,
            include: {
                campus: { select: { id: true, code: true, name: true } },
            },
        });
        return NextResponse.json({ course });
    } catch (error: any) {
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
