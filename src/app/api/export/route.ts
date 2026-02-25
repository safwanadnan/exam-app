/**
 * GET /api/export — Export schedule results (assignments)
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
            exam: { select: { name: true, examType: { select: { name: true } } } },
            period: { select: { date: true, startTime: true, endTime: true } },
            rooms: { include: { room: { select: { name: true, building: { select: { name: true } } } } } }
        },
        orderBy: [
            { period: { date: 'asc' } },
            { period: { startTime: 'asc' } }
        ]
    });

    // Format the output
    const exportData = assignments.map((a: any) => ({
        examName: a.exam.name || "Unnamed Exam",
        type: a.exam.examType.name,
        date: a.period.date.toISOString().split("T")[0],
        time: `${a.period.startTime} - ${a.period.endTime}`,
        rooms: a.rooms.map((r: any) => `${r.room.building.name} ${r.room.name}`).join(", ")
    }));

    const format = url.searchParams.get("format") || "json";

    if (format === "csv") {
        const csvHeader = "Exam,Type,Date,Time,Rooms\n";
        const csvRows = exportData.map((d: any) => `"${d.examName}","${d.type}","${d.date}","${d.time}","${d.rooms}"`).join("\n");
        return new NextResponse(csvHeader + csvRows, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": 'attachment; filename="schedule.csv"'
            }
        });
    }

    return jsonResponse(exportData);
});
