import { prisma } from "@/lib/prisma";
import { CalendarDays, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default async function SchedulePage({
    searchParams,
}: {
    searchParams: Promise<{ runId?: string }>;
}) {
    const resolvedParams = await searchParams;
    const runs = await prisma.solverRun.findMany({
        where: { status: "COMPLETE" },
        orderBy: { createdAt: "desc" },
        include: { config: { select: { name: true } } }
    });

    const activeRunId = resolvedParams?.runId || (runs.length > 0 ? runs[0].id : null);

    const assignments = activeRunId ? await prisma.examAssignment.findMany({
        where: { runId: activeRunId },
        include: {
            exam: { select: { name: true, length: true, _count: { select: { studentEnrollments: true } } } },
            period: true,
            rooms: { include: { room: { select: { name: true, building: { select: { code: true } } } } } }
        }
    }) : [];

    // Group by Period then by Room for the grid
    const periods = activeRunId ? await prisma.examPeriod.findMany({
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
    }) : [];

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Schedule View</h2>
                <div className="flex items-center gap-2">
                    {runs.length > 0 && (
                        <Select defaultValue={activeRunId || undefined}>
                            <SelectTrigger className="w-[250px] bg-background">
                                <SelectValue placeholder="Select Solver Run" />
                            </SelectTrigger>
                            <SelectContent>
                                {runs.map((r: any) => (
                                    <SelectItem key={r.id} value={r.id}>
                                        {r.config?.name || 'Default'} - {format(new Date(r.createdAt), "MMM d, HH:mm")}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button variant="outline">
                        <Filter className="mr-2 h-4 w-4" /> Filter
                    </Button>
                    <Button disabled={!activeRunId}>
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                </div>
            </div>

            {!activeRunId ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <CalendarDays className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                        <h3 className="font-semibold text-lg">No Schedules Available</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mt-1">
                            Run the solver to generate a schedule before viewing it here.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    <div className="flex gap-4 mb-4">
                        <div className="bg-muted px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2">
                            Total Assignments: <span className="text-primary">{assignments.length}</span>
                        </div>
                    </div>

                    <div className="grid gap-6">
                        {periods.map((period: any) => {
                            const periodAssignments = assignments.filter((a: any) => a.periodId === period.id);
                            if (periodAssignments.length === 0) return null;

                            return (
                                <Card key={period.id} className="overflow-hidden">
                                    <CardHeader className="bg-muted/10 border-b py-3">
                                        <CardTitle className="text-base flex justify-between items-center">
                                            <span>{format(new Date(period.date), "EEEE, MMM d, yyyy")}</span>
                                            <span className="text-muted-foreground font-normal">{period.startTime} - {period.endTime} ({period.length}m)</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {periodAssignments.map((assignment: any) => (
                                                <div key={assignment.id} className="bg-background border rounded-lg p-3 shadow-sm hover:border-primary transition-colors cursor-pointer">
                                                    <div className="font-semibold text-sm mb-1">{assignment.exam.name || "Unnamed Exam"}</div>
                                                    <div className="text-xs text-muted-foreground flex justify-between mb-2">
                                                        <span>{assignment.exam.length} mins</span>
                                                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{assignment.exam._count.studentEnrollments} students</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t">
                                                        {assignment.rooms.map((r: any) => (
                                                            <span key={r.roomId} className="text-[11px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                                                                {r.room.building.code} {r.room.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
