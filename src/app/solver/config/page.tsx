"use client";

import { useEffect, useState } from "react";
import { Settings2, Save, Plus, Trash2, Loader2, RotateCcw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Config {
    id: string; name: string; sessionId: string; isDefault: boolean;
    directConflictWeight: number; moreThan2ADayWeight: number;
    backToBackConflictWeight: number; distBackToBackConflictWeight: number;
    backToBackDistance: number; isDayBreakBackToBack: boolean;
    periodPenaltyWeight: number; roomSizePenaltyWeight: number;
    roomSplitPenaltyWeight: number; roomPenaltyWeight: number;
    distributionWeight: number; largeExamPenaltyWeight: number;
    largeExamSize: number;
    instructorDirectConflictWeight: number; instructorMoreThan2ADayWeight: number;
    instructorBackToBackConflictWeight: number; instructorDistBackToBackWeight: number;
    maxRooms: number; timeout: number;
    useGreatDeluge: boolean; useColoringConstruction: boolean;
    saInitialTemperature: number; saCoolingRate: number;
    hcMaxIdleIterations: number;
    [key: string]: any;
}

const WEIGHT_FIELDS = [
    { key: "directConflictWeight", label: "Direct Conflict", desc: "Penalty for students with two exams at the same time" },
    { key: "moreThan2ADayWeight", label: "More Than 2 a Day", desc: "Penalty for students with 3+ exams in one day" },
    { key: "backToBackConflictWeight", label: "Back-to-Back", desc: "Penalty for consecutive exam periods" },
    { key: "distBackToBackConflictWeight", label: "Distance Back-to-Back", desc: "Penalty when back-to-back exams are in distant buildings" },
    { key: "periodPenaltyWeight", label: "Period Penalty", desc: "Weight for period-specific penalties" },
    { key: "roomSizePenaltyWeight", label: "Room Size Penalty", desc: "Penalty for exam size vs room capacity mismatch" },
    { key: "roomSplitPenaltyWeight", label: "Room Split Penalty", desc: "Penalty for splitting an exam across multiple rooms" },
    { key: "roomPenaltyWeight", label: "Room Penalty", desc: "Weight for room-specific penalties" },
    { key: "distributionWeight", label: "Distribution Constraint", desc: "Weight for distribution constraint violations" },
    { key: "largeExamPenaltyWeight", label: "Large Exam Penalty", desc: "Extra weight for large exams" },
];

const INSTRUCTOR_FIELDS = [
    { key: "instructorDirectConflictWeight", label: "Direct Conflict", desc: "Penalty for instructor with overlapping exams" },
    { key: "instructorMoreThan2ADayWeight", label: "More Than 2 a Day", desc: "Penalty for instructor with 3+ exams" },
    { key: "instructorBackToBackConflictWeight", label: "Back-to-Back", desc: "Penalty for consecutive instructor exams" },
    { key: "instructorDistBackToBackWeight", label: "Distance Back-to-Back", desc: "Penalty for distant back-to-back instructor exams" },
];

export default function SolverConfigPage() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSession, setSelectedSession] = useState("");
    const [configs, setConfigs] = useState<Config[]>([]);
    const [activeConfig, setActiveConfig] = useState<Config | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showNewDialog, setShowNewDialog] = useState(false);
    const [newName, setNewName] = useState("");
    const [deleteConfig, setDeleteConfig] = useState<Config | null>(null);

    useEffect(() => {
        fetch("/api/sessions").then(r => r.json()).then(d => {
            setSessions(d.sessions || []);
            if (d.sessions?.length) setSelectedSession(d.sessions[0].id);
        }).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedSession) return;
        setLoading(true);
        fetch(`/api/solver/config?sessionId=${selectedSession}`).then(r => r.json()).then(d => {
            const cfgs = d.configs || [];
            setConfigs(cfgs);
            setActiveConfig(cfgs[0] || null);
            setLoading(false);
        });
    }, [selectedSession]);

    const handleSave = async () => {
        if (!activeConfig) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/solver/config/manage?id=${activeConfig.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(activeConfig),
            });
            if (!res.ok) throw new Error("Failed to save");
            toast.success("Configuration saved");
        } catch (e: any) { toast.error(e.message); }
        setSaving(false);
    };

    const handleCreate = async () => {
        if (!newName || !selectedSession) return;
        try {
            const res = await fetch("/api/solver/config/manage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName, sessionId: selectedSession }),
            });
            if (!res.ok) throw new Error("Failed to create");
            const config = await res.json();
            setConfigs(prev => [...prev, config]);
            setActiveConfig(config);
            setShowNewDialog(false);
            toast.success("Configuration created");
        } catch (e: any) { toast.error(e.message); }
    };

    const handleDelete = async () => {
        if (!deleteConfig) return;
        try {
            await fetch(`/api/solver/config/manage?id=${deleteConfig.id}`, { method: "DELETE" });
            setConfigs(prev => prev.filter(c => c.id !== deleteConfig.id));
            if (activeConfig?.id === deleteConfig.id) setActiveConfig(configs.find(c => c.id !== deleteConfig.id) || null);
            setDeleteConfig(null);
            toast.success("Configuration deleted");
        } catch (e: any) { toast.error(e.message); }
    };

    const updateField = (key: string, value: any) => {
        if (!activeConfig) return;
        setActiveConfig({ ...activeConfig, [key]: value });
    };

    const resetDefaults = () => {
        if (!activeConfig) return;
        setActiveConfig({
            ...activeConfig,
            directConflictWeight: 1000, moreThan2ADayWeight: 100,
            backToBackConflictWeight: 10, distBackToBackConflictWeight: 25,
            backToBackDistance: 67, periodPenaltyWeight: 1,
            roomSizePenaltyWeight: 0.001, roomSplitPenaltyWeight: 10,
            roomPenaltyWeight: 1, distributionWeight: 1,
            largeExamPenaltyWeight: 1, largeExamSize: 0,
            instructorDirectConflictWeight: 1000, instructorMoreThan2ADayWeight: 100,
            instructorBackToBackConflictWeight: 10, instructorDistBackToBackWeight: 25,
            maxRooms: 4, timeout: 600,
        });
        toast.info("Reset to defaults — save to apply");
    };

    if (loading) {
        return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Solver Configuration</h2>
                    <p className="text-muted-foreground mt-1">Tune optimization weights and parameters</p>
                </div>
                <div className="flex gap-2">
                    <Select value={selectedSession} onValueChange={setSelectedSession}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Session" /></SelectTrigger>
                        <SelectContent>
                            {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => { setNewName(""); setShowNewDialog(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> New Config
                    </Button>
                </div>
            </div>

            {configs.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                    {configs.map(c => (
                        <Button key={c.id} variant={activeConfig?.id === c.id ? "default" : "outline"} size="sm" onClick={() => setActiveConfig(c)}>
                            {c.name} {c.isDefault && "(Default)"}
                        </Button>
                    ))}
                </div>
            )}

            {!activeConfig ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <Settings2 className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                        <h3 className="font-semibold text-lg">No Configuration</h3>
                        <p className="text-sm text-muted-foreground mb-4">Create a solver configuration to get started.</p>
                        <Button onClick={() => { setNewName("Default"); setShowNewDialog(true); }}><Plus className="mr-2 h-4 w-4" /> Create Config</Button>
                    </CardContent>
                </Card>
            ) : (
                <Tabs defaultValue="student" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="student">Student Weights</TabsTrigger>
                        <TabsTrigger value="instructor">Instructor Weights</TabsTrigger>
                        <TabsTrigger value="solver">Solver Parameters</TabsTrigger>
                    </TabsList>

                    <TabsContent value="student">
                        <Card>
                            <CardHeader>
                                <CardTitle>Student Conflict Weights</CardTitle>
                                <CardDescription>Control how the solver penalizes different types of student conflicts</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-6 md:grid-cols-2">
                                    {WEIGHT_FIELDS.map(f => (
                                        <div key={f.key} className="space-y-2">
                                            <Label>{f.label}</Label>
                                            <Input type="number" step="any" value={activeConfig[f.key] ?? 0} onChange={e => updateField(f.key, parseFloat(e.target.value) || 0)} />
                                            <p className="text-xs text-muted-foreground">{f.desc}</p>
                                        </div>
                                    ))}
                                    <div className="space-y-2">
                                        <Label>Back-to-Back Distance (meters)</Label>
                                        <Input type="number" value={activeConfig.backToBackDistance} onChange={e => updateField("backToBackDistance", parseFloat(e.target.value) || 0)} />
                                        <p className="text-xs text-muted-foreground">Distance threshold for back-to-back building penalties</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Large Exam Threshold</Label>
                                        <Input type="number" value={activeConfig.largeExamSize} onChange={e => updateField("largeExamSize", parseFloat(e.target.value) || 0)} />
                                        <p className="text-xs text-muted-foreground">Exams with enrollment above this are treated as &ldquo;large&rdquo;</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="instructor">
                        <Card>
                            <CardHeader>
                                <CardTitle>Instructor Conflict Weights</CardTitle>
                                <CardDescription>Control penalties for instructor scheduling conflicts</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-6 md:grid-cols-2">
                                    {INSTRUCTOR_FIELDS.map(f => (
                                        <div key={f.key} className="space-y-2">
                                            <Label>{f.label}</Label>
                                            <Input type="number" step="any" value={activeConfig[f.key] ?? 0} onChange={e => updateField(f.key, parseFloat(e.target.value) || 0)} />
                                            <p className="text-xs text-muted-foreground">{f.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="solver">
                        <Card>
                            <CardHeader>
                                <CardTitle>Solver Parameters</CardTitle>
                                <CardDescription>Algorithm selection and runtime configuration</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Max Rooms per Exam</Label>
                                        <Input type="number" value={activeConfig.maxRooms} onChange={e => updateField("maxRooms", parseInt(e.target.value) || 4)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Timeout (seconds)</Label>
                                        <Input type="number" value={activeConfig.timeout} onChange={e => updateField("timeout", parseInt(e.target.value) || 600)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>SA Initial Temperature</Label>
                                        <Input type="number" step="0.1" value={activeConfig.saInitialTemperature} onChange={e => updateField("saInitialTemperature", parseFloat(e.target.value) || 1.5)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>SA Cooling Rate</Label>
                                        <Input type="number" step="0.01" value={activeConfig.saCoolingRate} onChange={e => updateField("saCoolingRate", parseFloat(e.target.value) || 0.95)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>HC Max Idle Iterations</Label>
                                        <Input type="number" value={activeConfig.hcMaxIdleIterations} onChange={e => updateField("hcMaxIdleIterations", parseInt(e.target.value) || 25000)} />
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                        <div>
                                            <Label>Use Great Deluge</Label>
                                            <p className="text-xs text-muted-foreground">Alternative to simulated annealing</p>
                                        </div>
                                        <Switch checked={activeConfig.useGreatDeluge || false} onCheckedChange={v => updateField("useGreatDeluge", v)} />
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                        <div>
                                            <Label>Graph Coloring Construction</Label>
                                            <p className="text-xs text-muted-foreground">Use graph coloring for initial solution</p>
                                        </div>
                                        <Switch checked={activeConfig.useColoringConstruction || false} onCheckedChange={v => updateField("useColoringConstruction", v)} />
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                        <div>
                                            <Label>Day Break Back-to-Back</Label>
                                            <p className="text-xs text-muted-foreground">Count last slot + first slot next day as back-to-back</p>
                                        </div>
                                        <Switch checked={activeConfig.isDayBreakBackToBack || false} onCheckedChange={v => updateField("isDayBreakBackToBack", v)} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}

            {activeConfig && (
                <div className="flex justify-between items-center pt-2">
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={resetDefaults}><RotateCcw className="mr-2 h-4 w-4" /> Reset Defaults</Button>
                        {configs.length > 1 && (
                            <Button variant="outline" size="sm" onClick={() => setDeleteConfig(activeConfig)}>
                                <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Delete
                            </Button>
                        )}
                    </div>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Configuration
                    </Button>
                </div>
            )}

            {/* New Config Dialog */}
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>New Solver Configuration</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Name</Label>
                            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Aggressive, Conservative" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={!newName}>Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Config Dialog */}
            <Dialog open={!!deleteConfig} onOpenChange={() => setDeleteConfig(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Configuration</DialogTitle>
                        <DialogDescription>Delete &ldquo;{deleteConfig?.name}&rdquo;? This cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfig(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
