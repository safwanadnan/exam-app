"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { format } from "date-fns";
import {
    CalendarDays, Download, Loader2, AlertTriangle, CheckCircle2,
    Search, Filter, X, Users, Clock, Building2, BarChart3, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Assignment {
    id: string;
    exam: { name: string; length: number; _count: { studentEnrollments: number } };
    period: { id: string; date: string; startTime: string; endTime: string; length: number };
    periodId: string;
    rooms: { roomId: string; room: { name: string; building: { code: string } } }[];
}

interface DetailedAssignment {
    id: string;
    examName: string;
    examLength: number;
    totalStudents: number;
    courses: string[];
    instructors: string[];
    period: { date: string; startTime: string; endTime: string };
    rooms: { name: string; capacity: number }[];
}

interface Clash {
    concurrentExamName: string;
    concurrentExamId: string;
    clashCount: number;
}

interface Period { id: string; date: string; startTime: string; endTime: string; length: number; }
interface Run { id: string; status: string; createdAt: string; config?: { name: string } | null; }

type FilterMode = "all" | "clashing" | "clean";

const BUILDING_COLORS: Record<string, string> = {};
const PALETTE = [
    { bg: "from-blue-500/15 to-blue-600/10", border: "border-blue-400/40", text: "text-blue-900 dark:text-blue-200", badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
    { bg: "from-violet-500/15 to-violet-600/10", border: "border-violet-400/40", text: "text-violet-900 dark:text-violet-200", badge: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" },
    { bg: "from-emerald-500/15 to-emerald-600/10", border: "border-emerald-400/40", text: "text-emerald-900 dark:text-emerald-200", badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
    { bg: "from-amber-500/15 to-amber-600/10", border: "border-amber-400/40", text: "text-amber-900 dark:text-amber-200", badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
    { bg: "from-rose-500/15 to-rose-600/10", border: "border-rose-400/40", text: "text-rose-900 dark:text-rose-200", badge: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300" },
    { bg: "from-cyan-500/15 to-cyan-600/10", border: "border-cyan-400/40", text: "text-cyan-900 dark:text-cyan-200", badge: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300" },
    { bg: "from-pink-500/15 to-pink-600/10", border: "border-pink-400/40", text: "text-pink-900 dark:text-pink-200", badge: "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300" },
    { bg: "from-indigo-500/15 to-indigo-600/10", border: "border-indigo-400/40", text: "text-indigo-900 dark:text-indigo-200", badge: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300" },
];

function StatCard({ label, value, icon: Icon, highlight }: { label: string; value: string | number; icon: any; highlight?: "red" | "green" }) {
    return (
        <div className={`flex items-center gap-3 bg-muted/40 border rounded-xl px-4 py-3 ${highlight === "red" ? "border-destructive/40 bg-destructive/5" : highlight === "green" ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}>
            <Icon className={`h-5 w-5 flex-shrink-0 ${highlight === "red" ? "text-destructive" : highlight === "green" ? "text-emerald-500" : "text-muted-foreground"}`} />
            <div>
                <div className={`text-2xl font-bold leading-none ${highlight === "red" ? "text-destructive" : highlight === "green" ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
        </div>
    );
}

export default function SchedulePage() {
    const [loading, setLoading] = useState(true);
    const [runs, setRuns] = useState<Run[]>([]);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [clashMap, setClashMap] = useState<Record<string, number>>({});
    const [periodClashMap, setPeriodClashMap] = useState<Record<string, number>>({});

    // Filter state
    const [searchQuery, setSearchQuery] = useState("");
    const [filterMode, setFilterMode] = useState<FilterMode>("all");

    // Highlighted card (from "jump to" in modal)
    const [highlightedId, setHighlightedId] = useState<string | null>(null);
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Modal state
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailedAssignment, setDetailedAssignment] = useState<DetailedAssignment | null>(null);
    const [clashes, setClashes] = useState<Clash[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const openAssignmentDetails = async (assignmentId: string) => {
        setIsDialogOpen(true);
        setDetailLoading(true);
        try {
            const res = await fetch(`/api/schedule/details?assignmentId=${assignmentId}`);
            const data = await res.json();
            if (res.ok) {
                setDetailedAssignment(data.details);
                setClashes(data.clashes || []);
            } else {
                toast.error(data.error || "Failed to load assignment details");
            }
        } catch {
            toast.error("An error occurred while fetching details");
        } finally {
            setDetailLoading(false);
        }
    };

    const jumpToExam = (examId: string) => {
        // Find the assignment that contains this exam ID
        const target = assignments.find(a => {
            // We don't have examId on the assignment directly, but we stored it in clashes via concurrentExamId
            return false; // We'll match by searching the clash map
        });
        setIsDialogOpen(false);
        // We'll use a timeout to let the dialog close first
        setTimeout(() => {
            const ref = cardRefs.current[examId];
            if (ref) {
                ref.scrollIntoView({ behavior: "smooth", block: "center" });
                setHighlightedId(examId);
                setTimeout(() => setHighlightedId(null), 2000);
            }
        }, 150);
    };

    useEffect(() => {
        fetch("/api/solver/runs").then(r => r.json()).then(data => {
            const completed = (data.runs || []).filter((r: Run) => r.status === "COMPLETED" || r.status === "COMPLETE");
            setRuns(completed);
            if (completed.length > 0) setSelectedRunId(completed[0].id);
            setLoading(false);
        }).catch(() => { setLoading(false); toast.error("Failed to load runs"); });
    }, []);

    useEffect(() => {
        if (!selectedRunId) return;
        setLoading(true);
        setClashMap({});
        setPeriodClashMap({});
        setSearchQuery("");
        setFilterMode("all");

        Promise.all([
            fetch(`/api/export?runId=${selectedRunId}`).then(r => r.json()),
            fetch("/api/periods?limit=200").then(r => r.json()),
            fetch(`/api/schedule/clash-summary?runId=${selectedRunId}`).then(r => r.json()),
        ]).then(([expData, perData, clashData]) => {
            setAssignments(expData.assignments || []);
            setPeriods(perData.periods || []);
            setClashMap(clashData.clashMap || {});
            setPeriodClashMap(clashData.periodClashMap || {});
            setLoading(false);
        }).catch(() => { setLoading(false); toast.error("Failed to load schedule"); });
    }, [selectedRunId]);

    const buildingColorIdx = useCallback(() => {
        const map = new Map<string, number>();
        let i = 0;
        assignments.forEach(a => {
            a.rooms.forEach(r => {
                const code = r.room.building.code;
                if (!map.has(code)) { map.set(code, i % PALETTE.length); i++; }
            });
        });
        return map;
    }, [assignments]);

    const colorIdxMap = buildingColorIdx();

    const getCardStyle = (a: Assignment) => {
        const buildingCode = a.rooms[0]?.room.building.code || "";
        const idx = colorIdxMap.get(buildingCode) ?? 0;
        return PALETTE[idx];
    };

    // Filtered assignments
    const filteredAssignments = useCallback((periodId?: string) => {
        let list = periodId ? assignments.filter(a => a.periodId === periodId) : assignments;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(a => (a.exam.name || "").toLowerCase().includes(q));
        }
        if (filterMode === "clashing") {
            list = list.filter(a => (clashMap[a.id] ?? 0) > 0);
        } else if (filterMode === "clean") {
            list = list.filter(a => (clashMap[a.id] ?? 0) === 0);
        }
        return list;
    }, [assignments, searchQuery, filterMode, clashMap]);

    // Stats
    const totalClashes = Object.values(clashMap).reduce((sum, v) => sum + v, 0);
    const uniqueRooms = new Set(assignments.flatMap(a => a.rooms.map(r => r.roomId))).size;
    const usedPeriods = new Set(assignments.map(a => a.periodId)).size;
    const clashedExams = Object.values(clashMap).filter(v => v > 0).length;

    const exportCsv = () => {
        const rows = [["Exam", "Date", "Time", "Duration", "Students", "Rooms", "Has Clashes"].join(",")];
        assignments.forEach(a => {
            rows.push([
                `"${a.exam.name || "Unnamed"}"`,
                format(new Date(a.period.date), "yyyy-MM-dd"),
                a.period.startTime,
                a.exam.length.toString(),
                a.exam._count.studentEnrollments.toString(),
                `"${a.rooms.map(r => `${r.room.building.code} ${r.room.name}`).join("; ")}"`,
                (clashMap[a.id] ?? 0) > 0 ? "YES" : "NO",
            ].join(","));
        });
        const blob = new Blob([rows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url;
        link.download = `schedule-${selectedRunId?.slice(0, 8)}.csv`;
        link.click(); URL.revokeObjectURL(url);
        toast.success("Schedule exported as CSV");
    };

    const exportPdf = () => {
        const doc = new jsPDF();
        const runName = runs.find(r => r.id === selectedRunId)?.config?.name || "Default";
        const dateStr = format(new Date(), "yyyy-MM-dd HH:mm");
        doc.setFontSize(18); doc.text("Exam Schedule", 14, 22);
        doc.setFontSize(11); doc.setTextColor(100);
        doc.text(`Run: ${runName} | Generated: ${dateStr}`, 14, 30);
        const tableData = assignments.map(a => [
            a.exam.name || "Unnamed",
            format(new Date(a.period.date), "MMM d, yyyy"),
            `${a.period.startTime} - ${a.period.endTime}`,
            `${a.exam.length}m`,
            a.exam._count.studentEnrollments.toString(),
            a.rooms.map(r => `${r.room.building.code} ${r.room.name}`).join("\n"),
            (clashMap[a.id] ?? 0) > 0 ? `⚠ ${clashMap[a.id]}` : "✓"
        ]);
        autoTable(doc, {
            startY: 36,
            head: [["Exam", "Date", "Time", "Duration", "Students", "Rooms", "Conflicts"]],
            body: tableData,
            theme: "grid",
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
        });
        doc.save(`exam-schedule-${selectedRunId?.slice(0, 8)}.pdf`);
        toast.success("Schedule exported as PDF");
    };

    return (
        <div className="flex-1 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Schedule View</h2>
                    <p className="text-muted-foreground text-sm mt-1">Interactive timetable — click any exam to see details and clashes</p>
                </div>
                <div className="flex items-center gap-2">
                    {runs.length > 0 && (
                        <Select value={selectedRunId || undefined} onValueChange={setSelectedRunId}>
                            <SelectTrigger className="w-[260px] bg-background">
                                <SelectValue placeholder="Select Run" />
                            </SelectTrigger>
                            <SelectContent>
                                {runs.map(r => (
                                    <SelectItem key={r.id} value={r.id}>
                                        {r.config?.name || "Default"} — {format(new Date(r.createdAt), "MMM d, HH:mm")}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button variant="outline" onClick={exportCsv} disabled={!selectedRunId || assignments.length === 0}>
                        <Download className="mr-2 h-4 w-4" /> CSV
                    </Button>
                    <Button onClick={exportPdf} disabled={!selectedRunId || assignments.length === 0}>
                        <Download className="mr-2 h-4 w-4" /> PDF
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : !selectedRunId ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-16 text-center">
                        <CalendarDays className="h-12 w-12 text-muted-foreground mb-4 opacity-40" />
                        <h3 className="font-semibold text-lg">No Schedules Available</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mt-1">Run the solver to generate a schedule, then come back here.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {/* Stats bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard label="Total Assignments" value={assignments.length} icon={CalendarDays} />
                        <StatCard label="Periods Used" value={usedPeriods} icon={Clock} />
                        <StatCard label="Rooms Used" value={uniqueRooms} icon={Building2} />
                        <StatCard
                            label={clashedExams > 0 ? `Exams with Clashes` : "No Clashes Detected"}
                            value={clashedExams > 0 ? clashedExams : "✓ Clean"}
                            icon={clashedExams > 0 ? AlertTriangle : CheckCircle2}
                            highlight={clashedExams > 0 ? "red" : "green"}
                        />
                    </div>

                    {/* Search & Filter bar */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[220px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search exam name…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border rounded-md bg-background outline-none focus:ring-2 focus:ring-primary/40 transition"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                            {(["all", "clashing", "clean"] as FilterMode[]).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setFilterMode(mode)}
                                    className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${filterMode === mode
                                        ? mode === "clashing"
                                            ? "bg-destructive text-white shadow"
                                            : mode === "clean"
                                                ? "bg-emerald-500 text-white shadow"
                                                : "bg-background shadow text-foreground"
                                        : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    {mode === "all" ? "All" : mode === "clashing" ? `⚠ Has Clashes` : "✓ Clash-Free"}
                                </button>
                            ))}
                        </div>

                        {/* Building legend */}
                        <div className="flex items-center gap-2 flex-wrap ml-auto">
                            {Array.from(colorIdxMap.entries()).map(([code, idx]) => {
                                const p = PALETTE[idx];
                                return (
                                    <span key={code} className={`px-2.5 py-1 rounded-md text-xs font-semibold border bg-gradient-to-br ${p.bg} ${p.border} ${p.text}`}>
                                        {code}
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {/* Periods grid */}
                    <div className="grid gap-5">
                        {periods.map(period => {
                            const pa = filteredAssignments(period.id);
                            if (pa.length === 0) return null;
                            const periodClashes = periodClashMap[period.id] ?? 0;
                            return (
                                <Card key={period.id} className="overflow-hidden shadow-sm">
                                    <CardHeader className="bg-muted/20 border-b py-3 px-5">
                                        <CardTitle className="text-base flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span>{format(new Date(period.date), "EEEE, MMM d, yyyy")}</span>
                                                {periodClashes > 0 && (
                                                    <Badge variant="destructive" className="text-[11px] py-0 px-2">
                                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                                        {periodClashes} clash{periodClashes !== 1 ? "es" : ""}
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="text-muted-foreground font-normal text-sm">
                                                {period.startTime} – {period.endTime}
                                                <span className="ml-2 text-xs text-muted-foreground/70">({period.length}m)</span>
                                            </span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                            {pa.map(a => {
                                                const style = getCardStyle(a);
                                                const clashes = clashMap[a.id] ?? 0;
                                                const isHighlighted = highlightedId === a.id;
                                                return (
                                                    <div
                                                        key={a.id}
                                                        ref={el => { cardRefs.current[a.id] = el; }}
                                                        onClick={() => openAssignmentDetails(a.id)}
                                                        className={`
                                                            relative border rounded-xl p-3.5 cursor-pointer transition-all duration-200 
                                                            bg-gradient-to-br ${style.bg} 
                                                            hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/40
                                                            ${clashes > 0
                                                                ? "border-destructive/50 ring-1 ring-destructive/30"
                                                                : `${style.border}`}
                                                            ${isHighlighted ? "ring-4 ring-primary scale-105 shadow-xl" : ""}
                                                        `}
                                                    >
                                                        {/* Clash / Clean badge */}
                                                        <div className="absolute top-2.5 right-2.5">
                                                            {clashes > 0 ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/90 text-white text-[10px] font-bold px-2 py-0.5 shadow">
                                                                    <AlertTriangle className="h-2.5 w-2.5" />
                                                                    {clashes}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center rounded-full bg-emerald-500/80 text-white text-[10px] px-1.5 py-0.5">
                                                                    <CheckCircle2 className="h-3 w-3" />
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Exam name */}
                                                        <div className={`font-semibold text-sm pr-10 leading-tight ${style.text}`}>
                                                            {a.exam.name || "Unnamed"}
                                                        </div>

                                                        {/* Meta */}
                                                        <div className="flex items-center gap-3 mt-2 text-xs opacity-70">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />{a.exam.length}m
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Users className="h-3 w-3" />{a.exam._count.studentEnrollments}
                                                            </span>
                                                        </div>

                                                        {/* Rooms */}
                                                        {a.rooms.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-2.5 pt-2.5 border-t border-current/10">
                                                                {a.rooms.map(r => (
                                                                    <span key={r.roomId} className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${style.badge}`}>
                                                                        {r.room.building.code} {r.room.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                        {filteredAssignments().length === 0 && assignments.length > 0 && (
                            <div className="text-center p-12 text-muted-foreground">
                                <Filter className="h-8 w-8 mx-auto mb-3 opacity-40" />
                                <p className="font-medium">No exams match your filter</p>
                                <button onClick={() => { setSearchQuery(""); setFilterMode("all"); }} className="text-sm text-primary mt-1 hover:underline">Clear filters</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Detail Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg">Exam Details</DialogTitle>
                    </DialogHeader>

                    {detailLoading ? (
                        <div className="flex justify-center p-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : detailedAssignment ? (
                        <div className="space-y-5">
                            {/* Title & time */}
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold">{detailedAssignment.examName || "Unnamed Exam"}</h3>
                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4" />
                                    {format(new Date(detailedAssignment.period.date), "EEEE, MMM d, yyyy")}
                                    <span className="opacity-40">|</span>
                                    <Clock className="h-4 w-4" />
                                    {detailedAssignment.period.startTime} – {detailedAssignment.period.endTime}
                                    <Badge variant="outline" className="ml-1">{detailedAssignment.examLength}m</Badge>
                                </p>
                            </div>

                            {/* Overview chips */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-muted/50 rounded-lg p-3 border space-y-0.5">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Students</div>
                                    <div className="text-2xl font-bold">{detailedAssignment.totalStudents}</div>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-3 border space-y-0.5">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Total Capacity</div>
                                    <div className="text-2xl font-bold">{detailedAssignment.rooms.reduce((s, r) => s + r.capacity, 0)}</div>
                                </div>
                            </div>

                            {/* Utilization bar */}
                            {(() => {
                                const cap = detailedAssignment.rooms.reduce((s, r) => s + r.capacity, 0);
                                const pct = cap > 0 ? Math.min(100, Math.round((detailedAssignment.totalStudents / cap) * 100)) : 0;
                                const overCapacity = detailedAssignment.totalStudents > cap;
                                return (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Room Utilization</span>
                                            <span className={overCapacity ? "text-destructive font-semibold" : ""}>{pct}%{overCapacity ? " — OVER CAPACITY" : ""}</span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2.5">
                                            <div
                                                className={`h-2.5 rounded-full transition-all ${pct > 90 ? "bg-destructive" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Courses & Instructors */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Courses</div>
                                    {detailedAssignment.courses.length > 0 ? (
                                        <ul className="text-sm space-y-1">
                                            {detailedAssignment.courses.map(c => <li key={c} className="flex items-start gap-1.5"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />{c}</li>)}
                                        </ul>
                                    ) : <p className="text-sm text-muted-foreground italic">None assigned</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Instructors</div>
                                    {detailedAssignment.instructors.length > 0 ? (
                                        <ul className="text-sm space-y-1">
                                            {detailedAssignment.instructors.map(i => <li key={i} className="flex items-start gap-1.5"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />{i}</li>)}
                                        </ul>
                                    ) : <p className="text-sm text-muted-foreground italic">None assigned</p>}
                                </div>
                            </div>

                            {/* Rooms */}
                            <div className="space-y-1.5">
                                <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center justify-between">
                                    <span>Rooms</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {detailedAssignment.rooms.map(r => {
                                        const over = detailedAssignment.totalStudents > r.capacity && detailedAssignment.rooms.length === 1;
                                        return (
                                            <div key={r.name} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${over ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-muted border"}`}>
                                                <Building2 className="h-3.5 w-3.5" />
                                                {r.name}
                                                <span className="text-muted-foreground text-xs font-normal">cap {r.capacity}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Clashes */}
                            {clashes.length > 0 ? (
                                <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-bold text-destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        {clashes.length} Student Clash{clashes.length !== 1 ? "es" : ""} Detected
                                    </div>
                                    <p className="text-xs text-destructive/70">
                                        These exams run at the same time and share enrolled students.
                                    </p>
                                    <ul className="space-y-2">
                                        {clashes.map((c, i) => {
                                            const severity = c.clashCount >= 5 ? "🔴 High" : c.clashCount >= 2 ? "🟡 Moderate" : "🟠 Low";
                                            return (
                                                <li key={i} className="flex items-center justify-between rounded-lg bg-destructive/10 px-3 py-2 text-sm">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-destructive">{c.concurrentExamName}</span>
                                                        <span className="text-xs text-destructive/60">{severity}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="destructive" className="text-[11px]">
                                                            {c.clashCount} student{c.clashCount !== 1 ? "s" : ""}
                                                        </Badge>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ) : (
                                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 flex items-center gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                                    <div>
                                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">No Student Clashes</div>
                                        <div className="text-xs text-emerald-600/70 dark:text-emerald-500/70">All enrolled students are free during this period.</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="p-6 text-center text-muted-foreground">No details found.</p>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
