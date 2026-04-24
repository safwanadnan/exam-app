"use client";

import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import {
    BarChart3, AlertTriangle, Building2, Clock, Loader2, Users,
    CheckCircle2, CalendarDays, ChevronDown, ChevronUp, TrendingUp, Activity, Search, ListFilter
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StudentDetail { id: string; name: string; externalId: string; }
interface Conflict {
    periodId: string; periodDate: string; periodTime: string;
    examA: { id: string; name: string; courseName: string };
    examB: { id: string; name: string; courseName: string };
    sharedStudents: number;
    students: StudentDetail[];
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

    // Conflict View State
    const [conflictView, setConflictView] = useState<"period" | "course" | "student">("period");
    const [conflictSearch, setConflictSearch] = useState("");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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
        setExpandedGroups(new Set());
        fetch(`/api/analytics?runId=${selectedRun}`).then(r => r.json()).then(d => {
            setData(d); setLoading(false);
        }).catch(() => { toast.error("Failed to load analytics"); setLoading(false); });
    }, [selectedRun]);

    const toggleExpand = (id: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const conflicts: Conflict[] = data?.conflicts || [];
    const roomUtil: RoomUtil[] = data?.roomUtilization || [];
    const periodUtil: PeriodUtil[] = data?.periodUtilization || [];
    const maxPeriodExams = Math.max(1, ...periodUtil.map(p => p.examCount));
    const maxPeriodStudents = Math.max(1, ...periodUtil.map(p => p.studentCount));
    const maxRoomUsed = Math.max(1, ...roomUtil.map(r => r.usedSlots));
    const totalConflictStudents = conflicts.reduce((a, c) => a + c.sharedStudents, 0);

    // ─── Process Conflicts for Views ──────────────────────────────────────────
    const groupedConflicts = useMemo(() => {
        const search = conflictSearch.toLowerCase();
        
        if (conflictView === "period") {
            const map = new Map<string, { date: string; time: string; items: Conflict[]; totalStudents: number }>();
            for (const c of conflicts) {
                if (search && !c.examA.courseName.toLowerCase().includes(search) && !c.examB.courseName.toLowerCase().includes(search)) continue;
                
                if (!map.has(c.periodId)) {
                    map.set(c.periodId, { date: c.periodDate, time: c.periodTime, items: [], totalStudents: 0 });
                }
                const group = map.get(c.periodId)!;
                group.items.push(c);
                group.totalStudents += c.sharedStudents;
            }
            return Array.from(map.entries()).sort((a, b) => b[1].totalStudents - a[1].totalStudents);
        } 
        
        if (conflictView === "course") {
            const map = new Map<string, { courseName: string; items: Conflict[]; uniqueStudents: Set<string> }>();
            for (const c of conflicts) {
                const addCourse = (courseName: string) => {
                    if (search && !courseName.toLowerCase().includes(search)) return;
                    if (!map.has(courseName)) {
                        map.set(courseName, { courseName, items: [], uniqueStudents: new Set() });
                    }
                    const group = map.get(courseName)!;
                    group.items.push(c);
                    c.students.forEach(s => group.uniqueStudents.add(s.id));
                };
                addCourse(c.examA.courseName);
                if (c.examA.courseName !== c.examB.courseName) addCourse(c.examB.courseName);
            }
            return Array.from(map.entries()).sort((a, b) => b[1].uniqueStudents.size - a[1].uniqueStudents.size);
        }

        if (conflictView === "student") {
            const map = new Map<string, { student: StudentDetail; items: Conflict[] }>();
            for (const c of conflicts) {
                for (const s of c.students) {
                    if (search && !s.name.toLowerCase().includes(search) && !s.externalId.toLowerCase().includes(search)) continue;
                    if (!map.has(s.id)) {
                        map.set(s.id, { student: s, items: [] });
                    }
                    map.get(s.id)!.items.push(c);
                }
            }
            return Array.from(map.entries()).sort((a, b) => b[1].items.length - a[1].items.length);
        }

        return [];
    }, [conflicts, conflictView, conflictSearch]);

    return (
        <div className="flex-1 space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
                    <p className="text-muted-foreground mt-1 text-sm">Comprehensive insights into your exam schedule</p>
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
                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="bg-muted/50 border">
                        <TabsTrigger value="overview">Overview & Utilization</TabsTrigger>
                        <TabsTrigger value="conflicts" className="relative">
                            Conflict Analysis
                            {conflicts.length > 0 && (
                                <span className="ml-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                                    {conflicts.length}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    {/* ─── OVERVIEW TAB ────────────────────────────────────────── */}
                    <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                                        {conflicts.length > 0 ? `${totalConflictStudents} student instances affected` : "No conflicts — optimal schedule!"}
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
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                        <div className="grid grid-cols-12 text-xs text-muted-foreground font-semibold uppercase tracking-wider px-1 sticky top-0 bg-background py-2">
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
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                        <div className="grid grid-cols-12 text-xs text-muted-foreground font-semibold uppercase tracking-wider px-1 sticky top-0 bg-background py-2">
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
                    </TabsContent>

                    {/* ─── CONFLICT ANALYSIS TAB ───────────────────────────────── */}
                    <TabsContent value="conflicts" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <Card className="border-destructive/20 shadow-sm">
                            <CardHeader className="bg-destructive/5 border-b border-destructive/10 pb-4">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-destructive">
                                            <AlertTriangle className="h-5 w-5" />
                                            Deep Conflict Analysis
                                        </CardTitle>
                                        <CardDescription className="mt-1 text-destructive/80 font-medium">
                                            {conflicts.length === 0 ? "No conflicts detected." : `Found ${conflicts.length} direct clashes affecting ${totalConflictStudents} student instances.`}
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="relative w-64">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                placeholder={conflictView === "student" ? "Search student..." : "Search course..."} 
                                                className="pl-8 bg-background h-9 text-sm"
                                                value={conflictSearch}
                                                onChange={e => setConflictSearch(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex items-center bg-background border rounded-md p-1 shadow-sm">
                                            <Button 
                                                variant={conflictView === "period" ? "secondary" : "ghost"} 
                                                size="sm" className="h-7 text-xs px-3"
                                                onClick={() => setConflictView("period")}
                                            >
                                                By Period
                                            </Button>
                                            <Button 
                                                variant={conflictView === "course" ? "secondary" : "ghost"} 
                                                size="sm" className="h-7 text-xs px-3"
                                                onClick={() => setConflictView("course")}
                                            >
                                                By Course
                                            </Button>
                                            <Button 
                                                variant={conflictView === "student" ? "secondary" : "ghost"} 
                                                size="sm" className="h-7 text-xs px-3"
                                                onClick={() => setConflictView("student")}
                                            >
                                                By Student
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {conflicts.length === 0 ? (
                                    <div className="p-16 text-center">
                                        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3 opacity-80" />
                                        <p className="text-emerald-700 dark:text-emerald-400 font-semibold text-lg">Perfect Schedule</p>
                                        <p className="text-sm text-muted-foreground mt-1">Every student has a unique exam slot.</p>
                                    </div>
                                ) : groupedConflicts.length === 0 ? (
                                    <div className="p-12 text-center text-muted-foreground">
                                        <p>No results match your search.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {groupedConflicts.map((group: any, idx) => {
                                            const id = group[0]; // The map key (periodId, courseName, or studentId)
                                            const data = group[1]; // The grouped data
                                            const isExpanded = expandedGroups.has(id);
                                            
                                            // Render logic based on view type
                                            if (conflictView === "period") {
                                                return (
                                                    <div key={id} className="hover:bg-muted/30 transition-colors">
                                                        <div 
                                                            className="flex items-center justify-between p-4 cursor-pointer select-none"
                                                            onClick={() => toggleExpand(id)}
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className="bg-destructive/10 text-destructive h-10 w-10 rounded-md flex flex-col items-center justify-center shrink-0 border border-destructive/20">
                                                                    <span className="text-xs font-bold">{format(new Date(data.date), "MMM d")}</span>
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold">{data.time}</div>
                                                                    <div className="text-xs text-muted-foreground">{data.items.length} clash{data.items.length > 1 ? "es" : ""}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <Badge variant="destructive" className="px-2 py-0.5">
                                                                    {data.totalStudents} students affected
                                                                </Badge>
                                                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                                            </div>
                                                        </div>
                                                        {isExpanded && (
                                                            <div className="bg-muted/10 p-4 border-t shadow-inner space-y-3">
                                                                {data.items.map((c: Conflict, i: number) => (
                                                                    <ConflictDetailRow key={i} conflict={c} />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            if (conflictView === "course") {
                                                return (
                                                    <div key={id} className="hover:bg-muted/30 transition-colors">
                                                        <div 
                                                            className="flex items-center justify-between p-4 cursor-pointer select-none"
                                                            onClick={() => toggleExpand(id)}
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 h-10 w-10 rounded-md flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
                                                                    <BarChart3 className="h-5 w-5" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold">{data.courseName}</div>
                                                                    <div className="text-xs text-muted-foreground">Involved in {data.items.length} conflict pairing{data.items.length > 1 ? "s" : ""}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50">
                                                                    {data.uniqueStudents.size} unique students affected
                                                                </Badge>
                                                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                                            </div>
                                                        </div>
                                                        {isExpanded && (
                                                            <div className="bg-muted/10 p-4 border-t shadow-inner space-y-3">
                                                                {data.items.map((c: Conflict, i: number) => (
                                                                    <ConflictDetailRow key={i} conflict={c} highlightCourse={data.courseName} />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            if (conflictView === "student") {
                                                return (
                                                    <div key={id} className="hover:bg-muted/30 transition-colors">
                                                        <div 
                                                            className="flex items-center justify-between p-4 cursor-pointer select-none"
                                                            onClick={() => toggleExpand(id)}
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 h-10 w-10 rounded-full flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
                                                                    <Users className="h-5 w-5" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold">{data.student.name}</div>
                                                                    <div className="text-xs text-muted-foreground font-mono">{data.student.externalId}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <Badge variant="outline" className="border-indigo-500/50 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50">
                                                                    {data.items.length} overlapping exams
                                                                </Badge>
                                                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                                            </div>
                                                        </div>
                                                        {isExpanded && (
                                                            <div className="bg-muted/10 p-4 border-t shadow-inner space-y-3">
                                                                {data.items.map((c: Conflict, i: number) => (
                                                                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background border p-3 rounded-md shadow-sm">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="bg-muted px-2 py-1 rounded text-xs font-medium shrink-0">
                                                                                {format(new Date(c.periodDate), "MMM d")} • {c.periodTime}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                                                                            <span className="font-semibold text-destructive truncate flex-1">{c.examA.courseName}</span>
                                                                            <span className="text-muted-foreground text-xs font-bold hidden sm:block">VS</span>
                                                                            <span className="text-muted-foreground text-xs font-bold sm:hidden">clashes with</span>
                                                                            <span className="font-semibold text-destructive truncate flex-1 sm:text-right">{c.examB.courseName}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}

// ─── Helper Component for Conflict Detail Row ─────────────────────────────
function ConflictDetailRow({ conflict: c, highlightCourse }: { conflict: Conflict, highlightCourse?: string }) {
    const aIsHighlight = highlightCourse && c.examA.courseName === highlightCourse;
    const bIsHighlight = highlightCourse && c.examB.courseName === highlightCourse;

    return (
        <div className="flex flex-col bg-background border p-3 rounded-lg shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{format(new Date(c.periodDate), "MMM d, yyyy")}</span>
                    <span>•</span>
                    <span>{c.periodTime}</span>
                </div>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-bold text-destructive border-destructive/20 bg-destructive/10">
                    {c.sharedStudents} Shared Student{c.sharedStudents !== 1 ? "s" : ""}
                </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border border-muted-foreground/20 rounded-full p-1 z-10 hidden md:block">
                    <span className="text-[10px] font-bold text-muted-foreground">VS</span>
                </div>
                
                <div className={cn("p-2 rounded border border-transparent", aIsHighlight ? "bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800" : "bg-muted/30")}>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Exam A</div>
                    <div className="font-semibold text-sm truncate" title={c.examA.courseName}>{c.examA.courseName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.examA.name}</div>
                </div>
                
                <div className={cn("p-2 rounded border border-transparent", bIsHighlight ? "bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800" : "bg-muted/30")}>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Exam B</div>
                    <div className="font-semibold text-sm truncate" title={c.examB.courseName}>{c.examB.courseName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.examB.name}</div>
                </div>
            </div>

            {/* Displaying student names if expanded */}
            {c.students && c.students.length > 0 && (
                <div className="mt-3 pt-2 border-t border-dashed">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Affected Students</div>
                    <div className="flex flex-wrap gap-1.5">
                        {c.students.slice(0, 10).map(s => (
                            <span key={s.id} className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground/80 border" title={s.externalId}>
                                {s.name}
                            </span>
                        ))}
                        {c.students.length > 10 && (
                            <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground italic border">
                                +{c.students.length - 10} more
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
