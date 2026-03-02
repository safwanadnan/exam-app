"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { CalendarDays, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface Period { id: string; date: string; startTime: string; endTime: string; length: number; }
interface Run { id: string; status: string; createdAt: string; config?: { name: string } | null; }

const COLORS = [
    "bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200",
    "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200",
    "bg-violet-500/10 border-violet-500/30 text-violet-900 dark:text-violet-200",
    "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200",
    "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200",
    "bg-cyan-500/10 border-cyan-500/30 text-cyan-900 dark:text-cyan-200",
    "bg-pink-500/10 border-pink-500/30 text-pink-900 dark:text-pink-200",
    "bg-indigo-500/10 border-indigo-500/30 text-indigo-900 dark:text-indigo-200",
];

export default function SchedulePage() {
    const [loading, setLoading] = useState(true);
    const [runs, setRuns] = useState<Run[]>([]);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);

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
        Promise.all([
            fetch(`/api/export?runId=${selectedRunId}`).then(r => r.json()),
            fetch("/api/periods?limit=200").then(r => r.json()),
        ]).then(([expData, perData]) => {
            setAssignments(expData.assignments || []);
            setPeriods(perData.periods || []);
            setLoading(false);
        }).catch(() => { setLoading(false); toast.error("Failed to load schedule"); });
    }, [selectedRunId]);

    const buildingColorMap = useCallback(() => {
        const map = new Map<string, string>();
        let i = 0;
        assignments.forEach(a => {
            a.rooms.forEach(r => {
                const code = r.room.building.code;
                if (!map.has(code)) { map.set(code, COLORS[i % COLORS.length]); i++; }
            });
        });
        return map;
    }, [assignments]);

    const colorMap = buildingColorMap();

    const exportCsv = () => {
        const rows = [["Exam", "Date", "Time", "Duration", "Students", "Rooms"].join(",")];
        assignments.forEach(a => {
            rows.push([
                `"${a.exam.name || "Unnamed"}"`,
                format(new Date(a.period.date), "yyyy-MM-dd"),
                a.period.startTime,
                a.exam.length.toString(),
                a.exam._count.studentEnrollments.toString(),
                `"${a.rooms.map(r => `${r.room.building.code} ${r.room.name}`).join("; ")}"`,
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

        doc.setFontSize(18);
        doc.text("Exam Schedule", 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Run: ${runName} | Generated: ${dateStr}`, 14, 30);

        const tableData = assignments.map(a => [
            a.exam.name || "Unnamed",
            format(new Date(a.period.date), "MMM d, yyyy"),
            `${a.period.startTime} - ${a.period.endTime}`,
            `${a.exam.length}m`,
            a.exam._count.studentEnrollments.toString(),
            a.rooms.map(r => `${r.room.building.code} ${r.room.name}`).join("\n")
        ]);

        autoTable(doc, {
            startY: 36,
            head: [["Exam", "Date", "Time", "Duration", "Students", "Rooms"]],
            body: tableData,
            theme: "grid",
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 5: { cellWidth: 40 } },
        });

        doc.save(`exam-schedule-${selectedRunId?.slice(0, 8)}.pdf`);
        toast.success("Schedule exported as PDF");
    };

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Schedule View</h2>
                <div className="flex items-center gap-2">
                    {runs.length > 0 && (
                        <Select value={selectedRunId || undefined} onValueChange={setSelectedRunId}>
                            <SelectTrigger className="w-[250px] bg-background"><SelectValue placeholder="Select Run" /></SelectTrigger>
                            <SelectContent>
                                {runs.map(r => <SelectItem key={r.id} value={r.id}>{r.config?.name || "Default"} — {format(new Date(r.createdAt), "MMM d, HH:mm")}</SelectItem>)}
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
                <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : !selectedRunId ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <CalendarDays className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                        <h3 className="font-semibold text-lg">No Schedules Available</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mt-1">Run the solver to generate a schedule.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    <div className="flex gap-4 mb-4 flex-wrap">
                        <div className="bg-muted px-4 py-2 rounded-md text-sm font-medium">
                            Total Assignments: <span className="text-primary">{assignments.length}</span>
                        </div>
                        {Array.from(colorMap.entries()).map(([code, classes]) => (
                            <div key={code} className={`px-3 py-1.5 rounded-md text-xs font-medium border ${classes}`}>{code}</div>
                        ))}
                    </div>
                    <div className="grid gap-6">
                        {periods.map(period => {
                            const pa = assignments.filter(a => a.periodId === period.id);
                            if (pa.length === 0) return null;
                            return (
                                <Card key={period.id} className="overflow-hidden">
                                    <CardHeader className="bg-muted/10 border-b py-3">
                                        <CardTitle className="text-base flex justify-between items-center">
                                            <span>{format(new Date(period.date), "EEEE, MMM d, yyyy")}</span>
                                            <span className="text-muted-foreground font-normal">{period.startTime} — {period.endTime} ({period.length}m)</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {pa.map(a => {
                                                const buildingCode = a.rooms[0]?.room.building.code || "";
                                                const colors = colorMap.get(buildingCode) || COLORS[0];
                                                return (
                                                    <div key={a.id} className={`border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow ${colors}`}>
                                                        <div className="font-semibold text-sm mb-1">{a.exam.name || "Unnamed"}</div>
                                                        <div className="text-xs opacity-75 flex justify-between mb-2">
                                                            <span>{a.exam.length}m</span>
                                                            <span className="font-medium">{a.exam._count.studentEnrollments} students</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-current/10">
                                                            {a.rooms.map(r => (
                                                                <span key={r.roomId} className="text-[11px] bg-background/60 px-1.5 py-0.5 rounded font-medium">
                                                                    {r.room.building.code} {r.room.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
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
