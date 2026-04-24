export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { prisma, jsonResponse, errorResponse, withErrorHandling } from "@/lib/api-helpers";

export const GET = withErrorHandling(async (req: NextRequest) => {
    const total = await prisma.student.count();
    if (total === 0) return errorResponse("No students found", 404);

    const randomIndex = Math.floor(Math.random() * total);
    const student = await prisma.student.findFirst({
        skip: randomIndex,
        select: { id: true }
    });

    if (!student) return errorResponse("Failed to pick random student", 500);

    return jsonResponse({ id: student.id });
});
