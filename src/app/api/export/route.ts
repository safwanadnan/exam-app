export const dynamic = 'force-dynamic';
/**
 * GET /api/export - Export schedule results (assignments)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma, jsonResponse, withErrorHandling } from "@/lib/api-helpers";

export const GET = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const runId = url.searchParams.get("runId");

    if (!runId) return jsonResponse({ error: "runId is required" }, 400);

    const assignments = await prisma.examAssignment.findMany({
        where: { runId },
        include: {
            exam: {
                select: {
                    name: true,
                    length: true,
                    examType: { select: { name: true } },
                    _count: { select: { studentEnrollments: true } },
                },
            },
            period: { select: { id: true, date: true, startTime: true, endTime: true, length: true } },
            rooms: {
                include: {
                    room: {
                        select: {
                            name: true,
                            building: { select: { code: true, name: true } },
                        },
                    },
                },
            },
        },
        orderBy: [
            { period: { date: 'asc' } },
            { period: { startTime: 'asc' } }
        ]
    });

    const format = url.searchParams.get("format") || "json";

    if (format === "csv") {
        const csvHeader = "Exam,Type,Date,Time,Duration,Students,Rooms\n";
        const csvRows = assignments.map((a: any) =>
            `"${a.exam.name || 'Unnamed'}","${a.exam.examType.name}","${a.period.date.toISOString().split('T')[0]}","${a.period.startTime} - ${a.period.endTime}","${a.exam.length}m","${a.exam._count.studentEnrollments}","${a.rooms.map((r: any) => `${r.room.building.name} ${r.room.name}`).join(', ')}"`
        ).join("\n");
        return new NextResponse(csvHeader + csvRows, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": 'attachment; filename="schedule.csv"'
            }
        });
    }

    // Return shape expected by schedule page: { assignments: [...] }
    return jsonResponse({ assignments });
});
