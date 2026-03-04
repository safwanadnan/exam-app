"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
    BarChart3, AlertTriangle, Building2, Clock, Loader2, Users,
    CheckCircle2, CalendarDays, ChevronDown, ChevronUp, TrendingUp, Activity
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Conflict {
    periodId: string; periodDate: string; periodTime: string;
    examA: { id: string; name: string };
    examB: { id: string; name: string };
    sharedStudents: number;
}
interface RoomUtil { name: string; building: string; capacity: number; usedSlots: number; totalStudents: number; }
interface PeriodUtil { date: string; time: string; examCount: number; studentCount: number; }

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
        </div>
    );
}

export default function AnalyticsPage() {
    const [runs, setRuns] = useState<any[]>([]);
    const [selectedRun, setSelectedRun] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [expandedConflict, setExpandedConflict] = useState<number | null>(null);

    useEffect(() => {
        fetch("/api/solver/runs").then(r => r.json()).then(d => {
            const completed = (d.runs || []).filter((r: any) => r.status === "COMPLETED" || r.status === "COMPLETE");
            setRuns(completed);
            if (completed.length) setSelectedRun(completed[0].id);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedRun) return;
        setLoading(true);
        setExpandedConflict(null);
        fetch(`/api/analytics?runId=${selectedRun}`).then(r => r.json()).then(d => {
            setData(d); setLoading(false);
        }).catch(() => { toast.error("Failed to load analytics"); setLoading(false); });
    }, [selectedRun]);

    const conflicts: Conflict[] = data?.conflicts || [];
    const roomUtil: RoomUtil[] = data?.roomUtilization || [];
    const periodUtil: PeriodUtil[] = data?.periodUtilization || [];
    const maxPeriodExams = Math.max(1, ...periodUtil.map(p => p.examCount));
    const maxPeriodStudents = Math.max(1, ...periodUtil.map(p => p.studentCount));
    const maxRoomUsed = Math.max(1, ...roomUtil.map(r => r.usedSlots));
    const totalConflictStudents = conflicts.reduce((a, c) => a + c.sharedStudents, 0);

    return (
        <div className="flex-1 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
                    <p className="text-muted-foreground mt-1 text-sm">Conflict analysis, room & period utilization insights</p>
                </div>
                <div className="flex items-center gap-3">
                    {runs.length > 0 && (
                        <Select value={selectedRun} onValueChange={setSelectedRun}>
                            <SelectTrigger className="w-[260px] bg-background">
                                <SelectValue placeholder="Select run" />
                            </SelectTrigger>
                            <SelectContent>
                                {runs.map((r: any) => (
                                    <SelectItem key={r.id} value={r.id}>
                                        {r.config?.name || "Default"} — {format(new Date(r.createdAt), "MMM d, HH:mm")}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button variant="outline" asChild>
                        <a href="/schedule">← Schedule View</a>
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : !selectedRun ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-16 text-center">
                        <BarChart3 className="h-12 w-12 text-muted-foreground mb-4 opacity-40" />
                        <h3 className="font-semibold text-lg">No Completed Runs</h3>
                        <p className="text-sm text-muted-foreground">Run the solver first to see analytics.</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Summary stat cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Assignments</CardTitle>
                                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{data?.assignmentCount || 0}</div>
                                <p className="text-xs text-muted-foreground mt-1">Exams scheduled</p>
                            </CardContent>
                        </Card>

                        <Card className={conflicts.length > 0 ? "border-destructive/40 bg-destructive/5" : "border-emerald-500/40 bg-emerald-500/5"}>
                            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Student Conflicts</CardTitle>
                                {conflicts.length > 0
                                    ? <AlertTriangle className="h-4 w-4 text-destructive" />
                                    : <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                }
                            </CardHeader>
                            <CardContent>
                                <div className={`text-3xl font-bold ${conflicts.length > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                                    {conflicts.length}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {conflicts.length > 0 ? `${totalConflictStudents} student instances affected` : "No conflicts — great schedule!"}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Rooms Used</CardTitle>
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{roomUtil.length}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Avg {roomUtil.length > 0 ? Math.round(roomUtil.reduce((s, r) => s + r.usedSlots, 0) / roomUtil.length) : 0} slots each
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Periods Used</CardTitle>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{periodUtil.length}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Avg {periodUtil.length > 0 ? Math.round(periodUtil.reduce((s, p) => s + p.examCount, 0) / periodUtil.length * 10) / 10 : 0} exams/period
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Conflicts section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className={`h-5 w-5 ${conflicts.length > 0 ? "text-destructive" : "text-emerald-500"}`} />
                                Student Conflicts
                                {conflicts.length > 0 && (
                                    <Badge variant="destructive" className="ml-2">{conflicts.length}</Badge>
                                )}
                            </CardTitle>
                            <CardDescription>
                                Students enrolled in multiple exams scheduled at the same time
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {conflicts.length === 0 ? (
                                <div className="p-8 text-center rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                                    <p className="text-emerald-700 dark:text-emerald-400 font-semibold">No student conflicts detected!</p>
                                    <p className="text-sm text-emerald-600/70 dark:text-emerald-500/70 mt-1">Every student has a unique exam slot — this is an optimal schedule.</p>
                                </div>
                            ) : (
                                <div className="border rounded-xl overflow-hidden divide-y">
                                    {conflicts.map((c, i) => {
                                        const severity = c.sharedStudents >= 5 ? { label: "High", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" }
                                            : c.sharedStudents >= 2 ? { label: "Moderate", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" }
                                                : { label: "Low", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" };
                                        const isExpanded = expandedConflict === i;
                                        return (
                                            <div key={i} className="bg-destructive/5 hover:bg-destructive/10 transition-colors">
                                                <button
                                                    className="w-full grid grid-cols-12 gap-4 items-center px-4 py-3 text-sm text-left"
                                                    onClick={() => setExpandedConflict(isExpanded ? null : i)}
                                                >
                                                    <div className="col-span-2">
                                                        <div className="font-medium">{format(new Date(c.periodDate), "MMM d")}</div>
                                                        <div className="text-xs text-muted-foreground">{c.periodTime}</div>
                                                    </div>
                                                    <div className="col-span-4 font-medium text-foreground">{c.examA.name}</div>
                                                    <div className="col-span-4 font-medium text-foreground">{c.examB.name}</div>
                                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${severity.cls}`}>{severity.label}</span>
                                                        <Badge variant="destructive">{c.sharedStudents}</Badge>
                                                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                                                    </div>
                                                </button>
                                                {isExpanded && (
                                                    <div className="px-4 pb-3 border-t border-destructive/20 bg-destructive/5">
                                                        <p className="text-xs text-destructive/60 font-semibold uppercase tracking-wider mt-2 mb-1">
                                                            {c.sharedStudents} student{c.sharedStudents !== 1 ? "s" : ""} double-booked in this period
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Click on either exam in the Schedule View to see the exact student names.
                                                        </p>
                                                        <div className="mt-2">
                                                            <a href={`/schedule?runId=${selectedRun}`} className="text-xs text-primary hover:underline">
                                                                → View in Schedule View
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Utilization charts */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Period Utilization */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-muted-foreground" />
                                    Period Utilization
                                </CardTitle>
                                <CardDescription>Exams and student load per exam period</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {/* Header */}
                                    <div className="grid grid-cols-12 text-xs text-muted-foreground font-semibold uppercase tracking-wider px-1">
                                        <span className="col-span-3">Period</span>
                                        <span className="col-span-4">Exams</span>
                                        <span className="col-span-4">Students</span>
                                        <span className="col-span-1 text-right">#</span>
                                    </div>
                                    {periodUtil.map((p, i) => (
                                        <div key={i} className="grid grid-cols-12 items-center gap-2">
                                            <div className="col-span-3">
                                                <div className="text-xs font-medium">{format(new Date(p.date), "MMM d")}</div>
                                                <div className="text-[11px] text-muted-foreground">{p.time.split('-')[0]}</div>
                                            </div>
                                            <div className="col-span-4">
                                                <MiniBar value={p.examCount} max={maxPeriodExams} color="bg-primary" />
                                            </div>
                                            <div className="col-span-4">
                                                <MiniBar value={p.studentCount} max={maxPeriodStudents} color="bg-violet-500" />
                                            </div>
                                            <div className="col-span-1 text-right text-xs font-medium">{p.examCount}</div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Room Utilization */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-muted-foreground" />
                                    Room Utilization
                                </CardTitle>
                                <CardDescription>How often each room is assigned across periods</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {/* Header */}
                                    <div className="grid grid-cols-12 text-xs text-muted-foreground font-semibold uppercase tracking-wider px-1">
                                        <span className="col-span-4">Room</span>
                                        <span className="col-span-5">Usage Rate</span>
                                        <span className="col-span-3 text-right">Slots / Cap</span>
                                    </div>
                                    {roomUtil.map((r, i) => {
                                        const usagePct = periodUtil.length > 0 ? Math.round((r.usedSlots / periodUtil.length) * 100) : 0;
                                        const barColor = usagePct > 75 ? "bg-emerald-500" : usagePct > 40 ? "bg-primary" : "bg-amber-500";
                                        return (
                                            <div key={i} className="grid grid-cols-12 items-center gap-2">
                                                <div className="col-span-4">
                                                    <div className="text-xs font-medium truncate">{r.building} {r.name}</div>
                                                    <div className="text-[11px] text-muted-foreground">cap {r.capacity}</div>
                                                </div>
                                                <div className="col-span-5">
                                                    <MiniBar value={r.usedSlots} max={maxRoomUsed} color={barColor} />
                                                </div>
                                                <div className="col-span-3 text-right">
                                                    <span className="text-xs font-medium">{r.usedSlots}</span>
                                                    <span className="text-[11px] text-muted-foreground">/{periodUtil.length}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Conflict Heatmap by period */}
                    {conflicts.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-destructive" />
                                    Conflict Distribution
                                </CardTitle>
                                <CardDescription>Which periods have the most student clashes</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {(() => {
                                        const byPeriod = new Map<string, { date: string; time: string; count: number; students: number }>();
                                        for (const c of conflicts) {
                                            const key = c.periodId;
                                            if (!byPeriod.has(key)) {
                                                byPeriod.set(key, { date: c.periodDate, time: c.periodTime, count: 0, students: 0 });
                                            }
                                            byPeriod.get(key)!.count++;
                                            byPeriod.get(key)!.students += c.sharedStudents;
                                        }
                                        const sorted = Array.from(byPeriod.values()).sort((a, b) => b.students - a.students);
                                        const maxStudents = Math.max(1, ...sorted.map(s => s.students));
                                        return sorted.map((p, i) => (
                                            <div key={i} className="flex items-center gap-4">
                                                <div className="w-28 shrink-0">
                                                    <div className="text-sm font-medium">{format(new Date(p.date), "MMM d")}</div>
                                                    <div className="text-[11px] text-muted-foreground">{p.time}</div>
                                                </div>
                                                <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                                                    <div
                                                        className="h-3 rounded-full bg-destructive transition-all"
                                                        style={{ width: `${(p.students / maxStudents) * 100}%` }}
                                                    />
                                                </div>
                                                <div className="w-32 text-right text-sm">
                                                    <span className="font-medium text-destructive">{p.students}</span>
                                                    <span className="text-muted-foreground"> students, </span>
                                                    <span className="font-medium">{p.count}</span>
                                                    <span className="text-muted-foreground"> clash{p.count !== 1 ? "es" : ""}</span>
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
