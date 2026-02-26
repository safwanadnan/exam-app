"use client";

import { useEffect, useState, useRef } from "react";
import { Play, Square, FastForward, Activity, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";


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
        return (
            <Card className="border-primary bg-primary/5">
                <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Activity className="h-8 w-8 text-primary animate-pulse" />
                        <div>
                            <h3 className="font-semibold text-lg text-primary">Engine Initializing</h3>
                            <p className="text-sm text-muted-foreground">Preparing data models and building domains...</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleStop} disabled={status === "STOPPING"}>
                        <Square className="mr-2 h-4 w-4" />
                        {status === "STOPPING" ? "Stopping..." : "Abort"}
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
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [startOpen, setStartOpen] = useState(false);
    const [sessions, setSessions] = useState<any[]>([]);
    const [configs, setConfigs] = useState<any[]>([]);
    const [selectedSession, setSelectedSession] = useState("");
    const [selectedConfig, setSelectedConfig] = useState("");
    const [starting, setStarting] = useState(false);

    const fetchRuns = () => {
        fetch('/api/solver/runs')
            .then(res => res.json())
            .then(data => { setRuns(data.runs || []); setLoading(false); });
    };

    useEffect(() => { fetchRuns(); }, []);

    const openStartDialog = async () => {
        try {
            const [sRes, cRes] = await Promise.all([
                fetch("/api/sessions"), fetch("/api/solver/config"),
            ]);
            const sData = await sRes.json();
            const cData = await cRes.json();
            setSessions(sData.sessions || []);
            setConfigs(cData.configs || []);
            if (sData.sessions?.length) setSelectedSession(sData.sessions[0].id);
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
                                            <Badge variant={run.status === "COMPLETE" ? "default" : run.status === "FAILED" ? "destructive" : "secondary"}>
                                                {run.status}
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Started {run.createdAt ? formatDistanceToNow(new Date(run.createdAt), { addSuffix: true }) : 'unknown time ago'}
                                        </div>
                                    </div>

                                    {run.status === "COMPLETE" && (
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
                                        <Button variant="outline" size="sm">Details</Button>
                                        {run.status === "COMPLETE" && (
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
