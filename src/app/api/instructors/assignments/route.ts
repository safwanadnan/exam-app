export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const assignSchema = z.object({
    instructorId: z.string().min(1),
    examId: z.string().min(1),
});

// GET: list all instructor-exam assignments, optionally filtered
export const GET = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const instructorId = url.searchParams.get("instructorId");
    const examId = url.searchParams.get("examId");

    const where: any = {};
    if (instructorId) where.instructorId = instructorId;
    if (examId) where.examId = examId;

    const assignments = await prisma.instructorAssignment.findMany({
        where,
        include: {
            instructor: { select: { id: true, name: true, externalId: true } },
            exam: { select: { id: true, name: true, length: true, size: true } },
        },
    });

    return jsonResponse({ assignments });
});

// POST: assign an instructor to an exam
export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, assignSchema);
    if (parsed.error) return parsed.error;

    const assignment = await prisma.instructorAssignment.create({
        data: parsed.data,
        include: {
            instructor: { select: { id: true, name: true, externalId: true } },
            exam: { select: { id: true, name: true } },
        },
    });

    return jsonResponse(assignment, 201);
});

// DELETE: remove an instructor assignment by composite key
export const DELETE = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const instructorId = url.searchParams.get("instructorId");
    const examId = url.searchParams.get("examId");

    if (!instructorId || !examId) {
        return jsonResponse({ error: "instructorId and examId are required" }, 400);
    }

    await prisma.instructorAssignment.delete({
        where: { instructorId_examId: { instructorId, examId } },
    });

    return jsonResponse({ success: true });
});
