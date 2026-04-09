"use client";

import { useEffect, useState, useRef } from "react";
import { Play, Square, FastForward, Activity, AlertCircle, CheckCircle2, Loader2, Info, ChevronDown, ChevronRight, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useAcademicSession } from "@/components/academic-session-provider";


// Mock progress component for the active solver 
// (In a real scenario, this connects to the SSE progress endpoint)
function PenaltyChart({ history }: { history: number[] }) {
    if (history.length < 2) return null;
    const max = Math.max(...history, 1);
    const min = Math.min(...history);
    const w = 300, h = 60, pad = 2;
    const points = history.map((v, i) => {
        const x = pad + (i / (history.length - 1)) * (w - pad * 2);
        const y = pad + ((max - v) / (max - min || 1)) * (h - pad * 2);
        return `${x},${y}`;
    }).join(" ");
    return (
        <div className="mt-4">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Penalty Convergence</div>
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16 rounded-md bg-background border">
                <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
                <polyline fill="url(#grad)" stroke="none" points={`${pad},${h} ${points} ${w - pad},${h}`} />
                <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" /></linearGradient></defs>
            </svg>
        </div>
    );
}

function ActiveSolverPanel({ runId }: { runId: string }) {
    const [progress, setProgress] = useState<any>(null);
    const [status, setStatus] = useState<string>("CONNECTING");
    const [penaltyHistory, setPenaltyHistory] = useState<number[]>([]);
    const eventSourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        // Connect to SSE stream
        const url = `/api/solver/runs/${runId}/progress`;
        const es = new EventSource(url);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.status === "INITIALIZING") {
                    setStatus("INITIALIZING");
                } else if (data.type === "ERROR") {
                    setStatus("FAILED");
                    es.close();
                } else if (data.type === "COMPLETE") {
                    setStatus("COMPLETE");
                    setProgress(data);
                    es.close();
                } else {
                    setStatus("RUNNING");
                    setProgress(data);
                    if (data.totalPenalty !== undefined) {
                        setPenaltyHistory(prev => {
                            const next = [...prev, Math.round(data.totalPenalty)];
                            return next.length > 100 ? next.slice(-100) : next;
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to parse SSE data", err);
            }
        };

        es.onerror = () => {
            setStatus("DISCONNECTED");
            es.close();
        };

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [runId]);

    const handleStop = async () => {
        try {
            await fetch(`/api/solver/runs/${runId}/stop`, { method: "POST" });
            setStatus("STOPPING");
        } catch (e) {
            console.error("Failed to stop solver", e);
        }
    };

    if (!progress && status !== "CONNECTING") {
        const isOffline = status === "FAILED" || status === "DISCONNECTED";
        return (
            <Card className="border-primary bg-primary/5">
                <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {isOffline ? (
                            <AlertCircle className="h-8 w-8 text-destructive" />
                        ) : (
                            <Activity className="h-8 w-8 text-primary animate-pulse" />
                        )}
                        <div>
                            <h3 className={`font-semibold text-lg ${isOffline ? "text-destructive" : "text-primary"}`}>
                                {isOffline ? "Solver Disconnected" : "Engine Initializing"}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {isOffline ? "The engine process stopped unexpectedly." : "Preparing data models and building domains..."}
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleStop} disabled={status === "STOPPING"}>
                        <Square className="mr-2 h-4 w-4" />
                        {status === "STOPPING" ? "Wait..." : (isOffline ? "Clear Run" : "Abort")}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const isComplete = status === "COMPLETE";
    const p = progress || {};

    return (
        <Card className={isComplete ? "border-emerald-500/50 bg-emerald-500/5" : "border-primary bg-primary/5"}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            {isComplete ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            ) : (
                                <Activity className="h-5 w-5 text-primary animate-pulse" />
                            )}
                            {isComplete ? "Schedule Generated" : "Solver Active"}
                            <Badge variant={isComplete ? "outline" : "default"} className={isComplete ? "text-emerald-500 border-emerald-500" : ""}>
                                {p.phase || "Phase 1"}
                            </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Iteration: {p.iteration?.toLocaleString() ?? 0}
                        </CardDescription>
                    </div>

                    <div className="flex gap-2">
                        {!isComplete && (
                            <Button variant="outline" size="sm" onClick={handleStop}>
                                <Square className="mr-2 h-4 w-4 text-destructive" /> Stop
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <div className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="font-medium">Variables Assigned</span>
                            <span className="text-muted-foreground">
                                {p.assignedExams ?? 0} / {p.totalExams ?? 0}
                                ({p.totalExams ? Math.round(((p.assignedExams ?? 0) / p.totalExams) * 100) : 0}%)
                            </span>
                        </div>
                        <Progress
                            value={p.totalExams ? ((p.assignedExams ?? 0) / p.totalExams) * 100 : 0}
                            className="h-2"
                        />
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-background rounded-lg p-3 border">
                            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Total Penalty</div>
                            <div className="text-2xl font-bold font-mono">{Math.round(p.totalPenalty ?? 0).toLocaleString()}</div>
                        </div>
                        <div className="bg-background rounded-lg p-3 border">
                            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Hard Conflicts</div>
                            <div className={`text-2xl font-bold font-mono ${(p.directConflicts ?? 0) > 0 ? "text-destructive" : "text-emerald-500"}`}>
                                {p.directConflicts ?? 0}
                            </div>
                        </div>
                        <div className="bg-background rounded-lg p-3 border">
                            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Back-To-Back</div>
                            <div className="text-2xl font-bold font-mono">{p.backToBackConflicts ?? 0}</div>
                        </div>
                        <div className="bg-background rounded-lg p-3 border">
                            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Best Time</div>
                            <div className="text-xl font-bold font-mono py-1">
                                {p.timeSecs ? `${p.timeSecs.toFixed(1)}s` : '0.0s'}
                            </div>
                        </div>
                    </div>
                    <PenaltyChart history={penaltyHistory} />
                </div>
            </CardContent>
        </Card>
    );
}

export default function SolverDashboard() {
    const { currentSessionId } = useAcademicSession();
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [startOpen, setStartOpen] = useState(false);
    const [sessions, setSessions] = useState<any[]>([]);
    const [configs, setConfigs] = useState<any[]>([]);
    const [selectedSession, setSelectedSession] = useState("");
    const [selectedConfig, setSelectedConfig] = useState("");
    const [starting, setStarting] = useState(false);
    const [detailsRun, setDetailsRun] = useState<any>(null);
    const [detailsDiag, setDetailsDiag] = useState<any>(null);
    const [loadingDiag, setLoadingDiag] = useState(false);
    const [showUnassigned, setShowUnassigned] = useState(false);

    const fetchRuns = () => {
        setLoading(true);
        const url = currentSessionId ? `/api/solver/runs?sessionId=${currentSessionId}` : '/api/solver/runs';
        fetch(url)
            .then(res => res.json())
            .then(data => { setRuns(data.runs || []); setLoading(false); });
    };

    useEffect(() => { fetchRuns(); }, [currentSessionId]);

    const openStartDialog = async () => {
        try {
            const [sRes, cRes] = await Promise.all([
                fetch("/api/sessions"), fetch("/api/solver/config"),
            ]);
            const sData = await sRes.json();
            const cData = await cRes.json();
            setSessions(sData.sessions || []);
            setConfigs(cData.configs || []);
            if (currentSessionId) setSelectedSession(currentSessionId);
            else if (sData.sessions?.length) setSelectedSession(sData.sessions[0].id);
            
            if (cData.configs?.length) setSelectedConfig(cData.configs[0].id);
            setStartOpen(true);
        } catch { toast.error("Failed to load sessions/configs"); }
    };

    const handleStart = async () => {
        if (!selectedSession || !selectedConfig) { toast.error("Select session and config"); return; }
        setStarting(true);
        try {
            const res = await fetch("/api/solver/runs", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: selectedSession, configId: selectedConfig }),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to start"); }
            toast.success("Solver started!"); setStartOpen(false); fetchRuns();
        } catch (err: any) { toast.error(err.message); }
        finally { setStarting(false); }
    };

    const openDetails = async (run: any) => {
        setDetailsRun(run);
        setDetailsDiag(null);
        setShowUnassigned(false);
        setLoadingDiag(true);
        try {
            const res = await fetch(`/api/solver/runs/${run.id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.diagnostics) {
                    setDetailsDiag(data.diagnostics);
                }
            }
        } catch { /* ignore */ }
        finally { setLoadingDiag(false); }
    };

    const activeRun = runs.find(r => r.status === "RUNNING" || r.status === "PENDING" || r.status === "PHASE_1" || r.status === "PHASE_2" || r.status === "PHASE_3" || r.status === "FINALIZATION");

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Solver Dashboard</h2>
                <Button onClick={openStartDialog}>
                    <Play className="mr-2 h-4 w-4" /> New Optimization Run
                </Button>
            </div>

            {activeRun && (
                <ActiveSolverPanel runId={activeRun.id} />
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Run History</CardTitle>
                    <CardDescription>
                        Previous scheduling optimization runs and their final results.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md divide-y">
                        {runs.filter(r => r.id !== activeRun?.id).length === 0 && !loading ? (
                            <div className="p-8 text-center text-muted-foreground">
                                No previous solver runs found.
                            </div>
                        ) : (
                            runs.filter(r => r.id !== activeRun?.id).map((run) => (
                                <div key={run.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/5 transition-colors">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-foreground">
                                                {run.config?.name || "Default Configuration"}
                                            </span>
                                            <Badge variant={run.status.includes("COMPLETE") ? "default" : run.status === "FAILED" ? "destructive" : "secondary"}>
                                                {run.status}
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Started {run.createdAt ? formatDistanceToNow(new Date(run.createdAt), { addSuffix: true }) : 'unknown time ago'}
                                        </div>
                                    </div>

                                    {run.status.includes("COMPLETE") && (
                                        <div className="flex gap-6 text-sm">
                                            <div className="flex flex-col items-end">
                                                <span className="text-muted-foreground text-xs uppercase">Assigned</span>
                                                <span className="font-semibold">{run.assignedExams}/{run.totalExams}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-muted-foreground text-xs uppercase">Penalty</span>
                                                <span className="font-semibold">{Math.round(run.totalPenalty || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-muted-foreground text-xs uppercase">Hard Conflicts</span>
                                                <span className={`font-semibold ${run.directConflicts > 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                                                    {run.directConflicts || 0}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => openDetails(run)}>Details</Button>
                                        {run.status.includes("COMPLETE") && (
                                            <Button variant="secondary" size="sm" onClick={() => window.location.href = `/schedule?runId=${run.id}`}>View Schedule</Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}

                        {loading && (
                            <div className="p-8 text-center text-muted-foreground animate-pulse">
                                Loading history...
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Run Details Dialog */}
            <Dialog open={!!detailsRun} onOpenChange={(o) => { if (!o) { setDetailsRun(null); setDetailsDiag(null); } }}>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Run Details</DialogTitle>
                        <DialogDescription>Performance metrics, diagnostics, and breakdown for this solver run.</DialogDescription>
                    </DialogHeader>
                    {detailsRun && (
                        <div className="space-y-6 py-4">
                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Status</div>
                                    <Badge variant={detailsRun.status.includes("COMPLETE") ? "default" : detailsRun.status === "FAILED" ? "destructive" : "secondary"}>
                                        {detailsRun.status}
                                    </Badge>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Config</div>
                                    <div className="font-medium text-sm">{detailsRun.config?.name || "Default"}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Exams Assigned</div>
                                    <div className="font-medium text-sm">
                                        {detailsRun.assignedExams ?? 0} / {detailsRun.totalExams ?? 0}
                                        <span className="text-muted-foreground ml-1">
                                            ({detailsRun.totalExams ? Math.round(((detailsRun.assignedExams ?? 0) / detailsRun.totalExams) * 100) : 0}%)
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Time Taken</div>
                                    <div className="font-medium text-sm">
                                        {(detailsRun.startedAt && detailsRun.completedAt) ?
                                            `${((new Date(detailsRun.completedAt).getTime() - new Date(detailsRun.startedAt).getTime()) / 1000).toFixed(1)}s` : "Unknown"}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-background rounded-lg p-3 border">
                                    <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Total Penalty</div>
                                    <div className="text-xl font-bold font-mono">{Math.round(detailsRun.totalPenalty ?? 0).toLocaleString()}</div>
                                </div>
                                <div className="bg-background rounded-lg p-3 border">
                                    <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Hard Conflicts</div>
                                    <div className={`text-xl font-bold font-mono ${(detailsRun.directConflicts ?? 0) > 0 ? "text-destructive" : "text-emerald-500"}`}>
                                        {detailsRun.directConflicts ?? 0}
                                    </div>
                                </div>
                                <div className="bg-background rounded-lg p-3 border">
                                    <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Back-to-Back</div>
                                    <div className="text-xl font-bold font-mono">{detailsRun.backToBackConflicts ?? 0}</div>
                                </div>
                                <div className="bg-background rounded-lg p-3 border">
                                    <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Iterations</div>
                                    <div className="text-xl font-bold font-mono">{(detailsRun.iterations ?? 0).toLocaleString()}</div>
                                </div>
                            </div>

                            {/* Diagnostics Section */}
                            {loadingDiag && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading diagnostics...
                                </div>
                            )}

                            {detailsDiag && (
                                <div className="space-y-4">
                                    {/* Top Issues */}
                                    {detailsDiag.topIssues && detailsDiag.topIssues.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                                <Info className="h-4 w-4 text-primary" />
                                                Solver Analysis
                                            </h4>
                                            <div className="space-y-1.5">
                                                {detailsDiag.topIssues.map((issue: string, i: number) => (
                                                    <div key={i} className="text-sm flex items-start gap-2 p-2 rounded-md bg-muted/50 border">
                                                        {issue.includes("successfully") ? (
                                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                                                        ) : issue.includes("reduced") ? (
                                                            <Activity className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                                        ) : (
                                                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                                        )}
                                                        <span>{issue}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Phase Summaries */}
                                    {detailsDiag.phaseSummaries && detailsDiag.phaseSummaries.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-semibold">Phase Breakdown</h4>
                                            <div className="border rounded-md overflow-hidden">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-muted">
                                                        <tr>
                                                            <th className="text-left p-2 font-semibold">Phase</th>
                                                            <th className="text-right p-2 font-semibold">Duration</th>
                                                            <th className="text-right p-2 font-semibold">Iterations</th>
                                                            <th className="text-right p-2 font-semibold">Accepted</th>
                                                            <th className="text-right p-2 font-semibold">Start Obj</th>
                                                            <th className="text-right p-2 font-semibold">End Obj</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {detailsDiag.phaseSummaries.map((ps: any, i: number) => (
                                                            <tr key={i} className="hover:bg-muted/30">
                                                                <td className="p-2 font-medium">{ps.phase}</td>
                                                                <td className="p-2 text-right font-mono">{(ps.durationMs / 1000).toFixed(1)}s</td>
                                                                <td className="p-2 text-right font-mono">{(ps.endIteration - ps.startIteration).toLocaleString()}</td>
                                                                <td className="p-2 text-right font-mono">{ps.movesAccepted.toLocaleString()}</td>
                                                                <td className="p-2 text-right font-mono">{Math.round(ps.startObjective).toLocaleString()}</td>
                                                                <td className="p-2 text-right font-mono">
                                                                    <span className={ps.endObjective < ps.startObjective ? "text-emerald-500" : ""}>
                                                                        {Math.round(ps.endObjective).toLocaleString()}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Unassigned Exams */}
                                    {detailsDiag.unassignedCount > 0 && (
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => setShowUnassigned(!showUnassigned)}
                                                className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors w-full text-left"
                                            >
                                                {showUnassigned ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                <XCircle className="h-4 w-4 text-destructive" />
                                                Unassigned Exams ({detailsDiag.unassignedCount})
                                            </button>

                                            {showUnassigned && (
                                                <div className="border rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-muted sticky top-0">
                                                            <tr>
                                                                <th className="text-left p-2 font-semibold">Exam</th>
                                                                <th className="text-right p-2 font-semibold">Students</th>
                                                                <th className="text-left p-2 font-semibold">Reason</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y">
                                                            {detailsDiag.examDiagnostics
                                                                .filter((d: any) => !d.assigned)
                                                                .map((d: any) => (
                                                                    <tr key={d.examId} className="hover:bg-muted/30">
                                                                        <td className="p-2 font-medium max-w-[160px] truncate" title={d.examName}>{d.examName}</td>
                                                                        <td className="p-2 text-right font-mono">{d.examSize}</td>
                                                                        <td className="p-2">
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {d.failureReasons.map((r: string) => (
                                                                                    <Badge key={r} variant="outline" className="text-[10px] py-0 px-1.5">
                                                                                        {r.replace(/_/g, " ")}
                                                                                    </Badge>
                                                                                ))}
                                                                            </div>
                                                                            {d.details.length > 0 && (
                                                                                <div className="text-[11px] text-muted-foreground mt-1">
                                                                                    {d.details[0]}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Period Rejection Summary */}
                                    {detailsDiag.unassignedCount > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-semibold">Failure Category Breakdown</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {(() => {
                                                    const unassigned = detailsDiag.examDiagnostics.filter((d: any) => !d.assigned);
                                                    const cats = [
                                                        { label: "No Periods", count: unassigned.filter((d: any) => d.failureReasons.includes("NO_PERIODS_IN_DOMAIN")).length, color: "text-red-500" },
                                                        { label: "No Rooms", count: unassigned.filter((d: any) => d.failureReasons.includes("NO_ROOMS_AVAILABLE")).length, color: "text-orange-500" },
                                                        { label: "Student Avail.", count: unassigned.filter((d: any) => d.failureReasons.includes("STUDENT_UNAVAILABILITY")).length, color: "text-amber-500" },
                                                        { label: "Hard Constraints", count: unassigned.filter((d: any) => d.failureReasons.includes("HARD_DISTRIBUTION_CONSTRAINT")).length, color: "text-violet-500" },
                                                    ];
                                                    return cats.filter(c => c.count > 0).map(c => (
                                                        <div key={c.label} className="bg-background rounded-lg p-3 border">
                                                            <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
                                                            <div className={`text-lg font-bold font-mono ${c.color}`}>{c.count}</div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!loadingDiag && !detailsDiag && detailsRun.status === "FAILED" && (
                                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm">
                                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                                    <span>This run failed before producing diagnostics. Check the server console for error details.</span>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Start Run Dialog */}
            <Dialog open={startOpen} onOpenChange={setStartOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Start Optimization Run</DialogTitle>
                        <DialogDescription>Select a session and solver configuration to begin.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Session</Label>
                            <Select value={selectedSession} onValueChange={setSelectedSession}>
                                <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                                <SelectContent>
                                    {sessions.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.term} {s.year})</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Configuration</Label>
                            <Select value={selectedConfig} onValueChange={setSelectedConfig}>
                                <SelectTrigger><SelectValue placeholder="Select config" /></SelectTrigger>
                                <SelectContent>
                                    {configs.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setStartOpen(false)}>Cancel</Button>
                        <Button onClick={handleStart} disabled={starting || !selectedSession || !selectedConfig}>
                            {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Play className="mr-2 h-4 w-4" /> Start Solver
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
