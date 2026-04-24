export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, errorResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

const updateStudentSchema = z.object({
    name: z.string().min(1).optional(),
    externalId: z.string().min(1).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    const student = await prisma.student.findUnique({
        where: { id },
        include: {
            enrollments: {
                where: sessionId ? { exam: { examType: { sessionId } } } : undefined,
                include: {
                    exam: {
                        select: {
                            id: true, name: true, length: true,
                            examType: { select: { name: true } },
                            assignments: {
                                take: 1,
                                orderBy: { createdAt: "desc" },
                                include: {
                                    period: { select: { date: true, startTime: true, endTime: true } },
                                    rooms: {
                                        include: {
                                            room: {
                                                select: {
                                                    name: true,
                                                    building: { select: { name: true } }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            _count: { 
                select: { 
                    enrollments: sessionId ? { where: { exam: { examType: { sessionId } } } } : true 
                } 
            },
        },
    });
    if (!student) return errorResponse("Student not found", 404);
    return jsonResponse(student);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: RouteContext) => {
    const { id } = await ctx.params;
    await prisma.student.delete({ where: { id } });
    return jsonResponse({ deleted: true });
});
