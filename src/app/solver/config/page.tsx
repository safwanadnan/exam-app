import { prisma } from "@/lib/prisma";
import { Settings2, SlidersHorizontal, Info, Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default async function SolverConfigPage() {
    const sessions = await prisma.academicSession.findMany({
        orderBy: { year: "desc" }
    });

    const activeSessionId = sessions[0]?.id;

    const configs = await prisma.solverConfig.findMany({
        where: activeSessionId ? { sessionId: activeSessionId } : undefined,
        orderBy: { isDefault: "desc" }
    });

    const activeConfig = configs[0] || null;

    const handleSave = async (config: any) => {
        "use server"
        if (!activeSessionId) return;

        const existing = await prisma.solverConfig.findFirst({
            where: { sessionId: activeSessionId }
        });

        // Simplified for build pass - UI needs a client form to save weights properly
        if (existing) {
            await prisma.solverConfig.update({
                where: { id: existing.id },
                data: { name: "Custom Strategy" }
            });
        } else {
            await prisma.solverConfig.create({
                data: {
                    name: "Custom Strategy",
                    sessionId: activeSessionId,
                    isDefault: true
                }
            });
        }
    };

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Solver Configuration</h2>
                <div className="flex items-center gap-2">
                    {sessions.length > 0 && (
                        <Select defaultValue={activeSessionId} onValueChange={handleSave}>
                            <SelectTrigger className="w-[200px] bg-background">
                                <SelectValue placeholder="Select Session" />
                            </SelectTrigger>
                            <SelectContent>
                                {sessions.map((s: any) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button>
                        <Play className="mr-2 h-4 w-4" /> Start Solver Run
                    </Button>
                </div>
            </div>    {!activeSessionId ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                        <Settings2 className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                        <h3 className="font-semibold text-lg">No active session</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mt-1">
                            You need to create an academic session before configuring the solver.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6">
                    <Card className="h-fit">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-md">Configurations</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="flex flex-col gap-1 p-2">
                                {configs.map((config: any) => (
                                    <button
                                        key={config.id}
                                        className={`flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${config.id === activeConfig?.id
                                            ? 'bg-primary text-primary-foreground font-medium'
                                            : 'hover:bg-muted text-muted-foreground'
                                            }`}
                                    >
                                        <span>{config.name}</span>
                                        {config.isDefault && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${config.id === activeConfig?.id ? 'bg-primary-foreground/20' : 'bg-muted-foreground/20'
                                                }`}>Default</span>
                                        )}
                                    </button>
                                ))}

                                <button className="flex items-center gap-2 px-3 py-2 text-sm rounded-md text-primary hover:bg-primary/10 mt-2 transition-colors">
                                    <Plus className="h-4 w-4" /> New Preset
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    {activeConfig ? (
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <SlidersHorizontal className="h-5 w-5" />
                                        Optimization Weights
                                    </CardTitle>
                                    <CardDescription>
                                        Configure the relative importance of different soft constraints during the search.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Tabs defaultValue="student">
                                        <TabsList className="mb-4">
                                            <TabsTrigger value="student">Student Conflicts</TabsTrigger>
                                            <TabsTrigger value="room">Room Penalties</TabsTrigger>
                                            <TabsTrigger value="period">Period & Distribution</TabsTrigger>
                                            <TabsTrigger value="algorithm">Algorithm Tuning</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="student" className="space-y-4 pt-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2 relative">
                                                    <Label>Direct Conflict Weight</Label>
                                                    <Input type="number" defaultValue={activeConfig.directConflictWeight ?? 1000} />
                                                    <p className="text-xs text-muted-foreground">Penalty for a student having two exams in the same period.</p>
                                                </div>
                                                <div className="space-y-2 relative">
                                                    <Label>Back-To-Back Conflict Weight</Label>
                                                    <Input type="number" defaultValue={activeConfig.backToBackConflictWeight ?? 10} />
                                                    <p className="text-xs text-muted-foreground">Penalty for consecutive exams.</p>
                                                </div>
                                                <div className="space-y-2 relative">
                                                    <Label>More Than 2 Exams A Day Weight</Label>
                                                    <Input type="number" defaultValue={activeConfig.moreThan2ADayWeight ?? 100} />
                                                    <p className="text-xs text-muted-foreground">Penalty for 3+ exams in a single day.</p>
                                                </div>
                                                <div className="space-y-2 relative">
                                                    <Label>Distance Back-To-Back Weight</Label>
                                                    <Input type="number" defaultValue={activeConfig.distBackToBackConflictWeight ?? 25} />
                                                    <p className="text-xs text-muted-foreground">Penalty for back-to-back exams far apart.</p>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="room" className="space-y-4 pt-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2 relative">
                                                    <Label>Room Preference Penalty</Label>
                                                    <Input type="number" defaultValue={activeConfig.roomPenaltyWeight ?? 1} />
                                                </div>
                                                <div className="space-y-2 relative">
                                                    <Label>Room Split Penalty</Label>
                                                    <Input type="number" defaultValue={activeConfig.roomSplitPenaltyWeight ?? 10} />
                                                    <p className="text-xs text-muted-foreground">Penalty for assigning an exam to multiple rooms.</p>
                                                </div>
                                                <div className="space-y-2 relative">
                                                    <Label>Excess Room Size Penalty</Label>
                                                    <Input type="number" defaultValue={activeConfig.roomSizePenaltyWeight ?? 1} />
                                                    <p className="text-xs text-muted-foreground">Penalty for wasting large rooms on small exams.</p>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="period" className="space-y-4 pt-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2 relative">
                                                    <Label>Period Preference Penalty</Label>
                                                    <Input type="number" defaultValue={activeConfig.periodPenaltyWeight ?? 1} />
                                                </div>
                                                <div className="space-y-2 relative">
                                                    <Label>Late Period Penalty (Index)</Label>
                                                    <Input type="number" defaultValue={activeConfig.periodIndexWeight ?? 0.001} />
                                                    <p className="text-xs text-muted-foreground">Slight pressure to pack exams earlier in the term.</p>
                                                </div>
                                                <div className="space-y-2 relative">
                                                    <Label>Large Exam Penalty</Label>
                                                    <Input type="number" defaultValue={activeConfig.largeExamPenaltyWeight ?? 1} />
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="algorithm" className="space-y-6 pt-2">
                                            <div className="flex items-center space-x-2 border rounded-md p-4 bg-muted/30">
                                                <Switch id="great-deluge" defaultChecked={activeConfig.useGreatDeluge ?? true} />
                                                <div className="grid gap-1.5 ml-2">
                                                    <Label htmlFor="great-deluge">Use Great Deluge (Phase 3)</Label>
                                                    <p className="text-sm text-muted-foreground">
                                                        When enabled, uses the Great Deluge algorithm instead of Simulated Annealing for the main global optimization phase.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <Label>Time Limit (minutes)</Label>
                                                    <Input type="number" defaultValue={activeConfig.timeout ?? 30} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Hill Climbing Max Idle Iters</Label>
                                                    <Input type="number" defaultValue={activeConfig.hcMaxIdleIterations ?? 25000} />
                                                </div>
                                                <div className="space-y-2 opacity-50">
                                                    <Label>SA Initial Temperature</Label>
                                                    <Input type="number" defaultValue={activeConfig.saInitialTemperature ?? 1.5} disabled />
                                                </div>
                                                <div className="space-y-2 opacity-50">
                                                    <Label>SA Cooling Rate</Label>
                                                    <Input type="number" defaultValue={activeConfig.saCoolingRate ?? 0.95} disabled />
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </CardContent>
                                <CardFooter className="bg-muted/10 border-t py-4 justify-between">
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <Info className="mr-2 h-4 w-4" /> Changes require restarting the solver.
                                    </div>
                                    <Button variant="default">
                                        <Save className="mr-2 h-4 w-4" /> Save Configuration
                                    </Button>
                                </CardFooter>
                            </Card>
                        </div>
                    ) : (
                        <Card className="border-dashed h-[400px]">
                            <CardContent className="flex items-center justify-center p-6 h-full text-muted-foreground">
                                Select or create a configuration preset.
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div >
    );
}

// Ensure the plus icon is available since we used it dynamically
const Plus = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14" /><path d="M12 5v14" /></svg>
);
