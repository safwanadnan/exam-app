"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { BarChart3, AlertTriangle, Building2, Clock, Loader2, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface Conflict {
    periodId: string; periodDate: string; periodTime: string;
    examA: { id: string; name: string }; examB: { id: string; name: string };
    sharedStudents: number;
}
interface RoomUtil { name: string; building: string; capacity: number; usedSlots: number; totalStudents: number; }
interface PeriodUtil { date: string; time: string; examCount: number; studentCount: number; }

export default function AnalyticsPage() {
    const [runs, setRuns] = useState<any[]>([]);
    const [selectedRun, setSelectedRun] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        fetch("/api/solver/runs").then(r => r.json()).then(d => {
            const completed = (d.runs || []).filter((r: any) => r.status === "COMPLETE");
            setRuns(completed);
            if (completed.length) setSelectedRun(completed[0].id);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedRun) return;
        setLoading(true);
        fetch(`/api/analytics?runId=${selectedRun}`).then(r => r.json()).then(d => {
            setData(d); setLoading(false);
        }).catch(() => { toast.error("Failed to load analytics"); setLoading(false); });
    }, [selectedRun]);

    const conflicts: Conflict[] = data?.conflicts || [];
    const roomUtil: RoomUtil[] = data?.roomUtilization || [];
    const periodUtil: PeriodUtil[] = data?.periodUtilization || [];
    const maxPeriodExams = Math.max(1, ...periodUtil.map(p => p.examCount));

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
                    <p className="text-muted-foreground mt-1">Conflict analysis and utilization insights</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" asChild>
                        <a href="/analytics/compare">Compare Runs</a>
                    </Button>
                    {runs.length > 0 && (
                        <Select value={selectedRun} onValueChange={setSelectedRun}>
                            <SelectTrigger className="w-[250px] bg-background"><SelectValue placeholder="Select run" /></SelectTrigger>
                            <SelectContent>
                                {runs.map((r: any) => (
                                    <SelectItem key={r.id} value={r.id}>{r.config?.name || "Default"} — {format(new Date(r.createdAt), "MMM d, HH:mm")}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : !selectedRun ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <BarChart3 className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                        <h3 className="font-semibold text-lg">No Completed Runs</h3>
                        <p className="text-sm text-muted-foreground">Run the solver first to see analytics.</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Assignments</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold">{data?.assignmentCount || 0}</div></CardContent>
                        </Card>
                        <Card className={conflicts.length > 0 ? "border-destructive/50" : "border-emerald-500/50"}>
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Student Conflicts</CardTitle></CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${conflicts.length > 0 ? "text-destructive" : "text-emerald-500"}`}>
                                    {conflicts.length}
                                </div>
                                <p className="text-xs text-muted-foreground">{conflicts.reduce((a, c) => a + c.sharedStudents, 0)} students affected</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Rooms Used</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold">{roomUtil.length}</div></CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Periods Used</CardTitle></CardHeader>
                            <CardContent><div className="text-2xl font-bold">{periodUtil.length}</div></CardContent>
                        </Card>
                    </div>

                    {/* Conflicts Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className={`h-5 w-5 ${conflicts.length > 0 ? "text-destructive" : "text-emerald-500"}`} />
                                Student Conflicts
                            </CardTitle>
                            <CardDescription>Students enrolled in multiple exams scheduled in the same period</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {conflicts.length === 0 ? (
                                <div className="p-6 text-center text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 rounded-lg">
                                    ✓ No student conflicts detected — great schedule!
                                </div>
                            ) : (
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Period</TableHead>
                                                <TableHead>Exam A</TableHead>
                                                <TableHead>Exam B</TableHead>
                                                <TableHead className="text-right">Shared Students</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {conflicts.map((c, i) => (
                                                <TableRow key={i} className="bg-destructive/5">
                                                    <TableCell className="text-sm">
                                                        <div>{format(new Date(c.periodDate), "MMM d")}</div>
                                                        <div className="text-xs text-muted-foreground">{c.periodTime}</div>
                                                    </TableCell>
                                                    <TableCell className="font-medium">{c.examA.name}</TableCell>
                                                    <TableCell className="font-medium">{c.examB.name}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="destructive">{c.sharedStudents}</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Period Utilization */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-muted-foreground" />Period Utilization</CardTitle>
                                <CardDescription>Number of exams scheduled per period</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {periodUtil.slice(0, 10).map((p, i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <div className="w-24 text-xs text-muted-foreground shrink-0">
                                                <div>{format(new Date(p.date), "MMM d")}</div>
                                                <div>{p.time}</div>
                                            </div>
                                            <div className="flex-1">
                                                <Progress value={(p.examCount / maxPeriodExams) * 100} className="h-4" />
                                            </div>
                                            <div className="w-20 text-right text-sm">
                                                <span className="font-medium">{p.examCount}</span>
                                                <span className="text-muted-foreground"> exams</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Room Utilization */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-muted-foreground" />Room Utilization</CardTitle>
                                <CardDescription>How frequently each room is used</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {roomUtil.slice(0, 10).map((r, i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <div className="w-28 shrink-0">
                                                <div className="text-sm font-medium">{r.building} {r.name}</div>
                                                <div className="text-xs text-muted-foreground">Cap: {r.capacity}</div>
                                            </div>
                                            <div className="flex-1">
                                                <Progress value={(r.usedSlots / periodUtil.length) * 100} className="h-4" />
                                            </div>
                                            <div className="w-16 text-right text-sm font-medium">{r.usedSlots} slots</div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
