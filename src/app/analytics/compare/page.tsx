"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, GitCompare, ArrowRight, Loader2, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ComparePage() {
    const [runs, setRuns] = useState<any[]>([]);
    const [runA, setRunA] = useState<string>("");
    const [runB, setRunB] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [diff, setDiff] = useState<any>(null);

    useEffect(() => {
        fetch("/api/solver/runs").then(r => r.json()).then(d => {
            const completed = (d.runs || []).filter((r: any) => r.status === "COMPLETE");
            setRuns(completed);
            if (completed.length >= 2) {
                setRunA(completed[1].id); // older
                setRunB(completed[0].id); // newer
            } else if (completed.length === 1) {
                setRunA(completed[0].id);
                setRunB(completed[0].id);
            }
        });
    }, []);

    const fetchDiff = async () => {
        if (!runA || !runB) return;
        setLoading(true); setDiff(null);
        try {
            const res = await fetch(`/api/analytics/compare?runA=${runA}&runB=${runB}`);
            const data = await res.json();
            if (res.ok) setDiff(data.diff);
            else throw new Error(data.error);
        } catch (e: any) { toast.error(e.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (runA && runB) fetchDiff(); }, [runA, runB]);

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild><Link href="/analytics"><ArrowLeft className="h-5 w-5" /></Link></Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Compare Schedules</h2>
                    <p className="text-muted-foreground mt-1">Analyze changes between two solver runs</p>
                </div>
            </div>

            <Card className="bg-muted/10 border-dashed">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-center gap-6 justify-center">
                        <div className="w-full md:w-1/3 space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Base Run (A)</label>
                            <Select value={runA} onValueChange={setRunA}>
                                <SelectTrigger className="bg-background"><SelectValue placeholder="Select Run A" /></SelectTrigger>
                                <SelectContent>
                                    {runs.map(r => (
                                        <SelectItem key={r.id} value={r.id}>{r.config?.name || "Default"} — {format(new Date(r.createdAt), "MMM d, HH:mm")}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col items-center justify-center shrink-0 mt-6 md:mt-0">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <GitCompare className="h-5 w-5" />
                            </div>
                        </div>

                        <div className="w-full md:w-1/3 space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Compare To (B)</label>
                            <Select value={runB} onValueChange={setRunB}>
                                <SelectTrigger className="bg-background"><SelectValue placeholder="Select Run B" /></SelectTrigger>
                                <SelectContent>
                                    {runs.map(r => (
                                        <SelectItem key={r.id} value={r.id}>{r.config?.name || "Default"} — {format(new Date(r.createdAt), "MMM d, HH:mm")}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : diff ? (
                <div className="space-y-6 animation-fade-in">
                    {/* Metrics Compare */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Objective Score</CardTitle></CardHeader>
                            <CardContent className="flex items-center gap-4">
                                <div className="text-xl font-mono">{diff.score.runA}</div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <div className="text-xl font-mono">{diff.score.runB}</div>
                                {diff.score.delta !== 0 && (
                                    <Badge variant={diff.score.delta < 0 ? "secondary" : "destructive"} className={diff.score.delta < 0 ? "ml-auto bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "ml-auto"}>
                                        {diff.score.delta > 0 ? "+" : ""}{diff.score.delta}
                                    </Badge>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Student Conflicts</CardTitle></CardHeader>
                            <CardContent className="flex items-center gap-4">
                                <div className="text-xl font-mono">{diff.conflicts.runA}</div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <div className="text-xl font-mono">{diff.conflicts.runB}</div>
                                {diff.conflicts.delta !== 0 && (
                                    <Badge variant={diff.conflicts.delta < 0 ? "secondary" : "destructive"} className={diff.conflicts.delta < 0 ? "ml-auto bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" : "ml-auto"}>
                                        {diff.conflicts.delta > 0 ? "+" : ""}{diff.conflicts.delta}
                                    </Badge>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Changed Exams Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Changed Assignments</CardTitle>
                            <CardDescription>{diff.changedExams.length} exams were scheduled differently in Run B compared to Run A.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {diff.changedExams.length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground border rounded-lg bg-muted/5">
                                    No assignment differences between these two runs.
                                </div>
                            ) : (
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[30%]">Exam</TableHead>
                                                <TableHead>Change</TableHead>
                                                <TableHead>Run A Assignment</TableHead>
                                                <TableHead>Run B Assignment</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="text-sm">
                                            {diff.changedExams.map((c: any, i: number) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-medium">{c.examName}</TableCell>
                                                    <TableCell>
                                                        {c.changeType === "ADDED" ? <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">Added</Badge> :
                                                            c.changeType === "REMOVED" ? <Badge variant="destructive">Removed</Badge> :
                                                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20">Modified</Badge>}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {c.old ? (
                                                            <>
                                                                <div>{c.old.period ? `${c.old.period.startTime}-${c.old.period.endTime}` : "No time"}</div>
                                                                <div className="text-xs mt-1">{c.old.rooms.join(", ") || "No rooms"}</div>
                                                            </>
                                                        ) : "—"}
                                                    </TableCell>
                                                    <TableCell className={c.changeType === "MODIFIED" ? "text-blue-600 dark:text-blue-400 font-medium" : "text-foreground"}>
                                                        {c.new ? (
                                                            <>
                                                                <div>{c.new.period ? `${c.new.period.startTime}-${c.new.period.endTime}` : "No time"}</div>
                                                                <div className="text-xs mt-1">{c.new.rooms.join(", ") || "No rooms"}</div>
                                                            </>
                                                        ) : "—"}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            ) : null}
        </div>
    );
}
