"use client";

import { useEffect, useState } from "react";
import { Plus, Settings2, Search, MoreHorizontal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { HelpTip } from "@/components/tip";
import { DataPagination } from "@/components/data-pagination";
import { useAcademicSession } from "@/components/academic-session-provider";

const CONSTRAINT_TYPES = [
    "SAME_ROOM", "DIFF_ROOM", "SAME_PERIOD", "DIFF_PERIOD",
    "PRECEDENCE", "PRECEDENCE_REV", "SAME_DAY", "DIFF_DAY",
    "SAME_INSTRUCTOR", "DIFF_INSTRUCTOR",
];

interface Constraint {
    id: string; type: string; hard: boolean; weight: number;
    examAId: string; examBId: string;
    examA: { name: string; examType?: { session?: { name: string } } };
    examB: { name: string };
}

interface ExamOption { id: string; name: string; }

function ConstraintDialog({ constraint, exams, open, onOpenChange, onSaved }: {
    constraint?: Constraint | null; exams: ExamOption[]; open: boolean;
    onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
    const isEditing = !!constraint;
    const [saving, setSaving] = useState(false);
    const [type, setType] = useState("SAME_PERIOD");
    const [hard, setHard] = useState(false);
    const [weight, setWeight] = useState(1);
    const [examAId, setExamAId] = useState("");
    const [examBId, setExamBId] = useState("");

    useEffect(() => {
        if (constraint) {
            setType(constraint.type); setHard(constraint.hard); setWeight(constraint.weight);
            setExamAId(constraint.examAId); setExamBId(constraint.examBId);
        } else {
            setType("SAME_PERIOD"); setHard(false); setWeight(1);
            setExamAId(exams[0]?.id || ""); setExamBId(exams[1]?.id || exams[0]?.id || "");
        }
    }, [constraint, open, exams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            const body = { type, hard, weight, examAId, examBId };
            const url = isEditing ? `/api/constraints/${constraint!.id}` : "/api/constraints";
            const res = await fetch(url, { method: isEditing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
            toast.success(isEditing ? "Constraint updated" : "Constraint created");
            onOpenChange(false); onSaved();
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Edit Constraint" : "Add Constraint"}</DialogTitle>
                        <DialogDescription>Define a distribution rule between two exams.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Constraint Type <HelpTip text="The scheduling rule: SAME_PERIOD forces both exams at the same time, DIFF_PERIOD separates them, PRECEDENCE ensures A comes before B, etc." /></Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{CONSTRAINT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Primary Exam (A) <HelpTip text="The first exam in the constraint pair. For PRECEDENCE, this exam must come before Exam B." /></Label>
                            <Select value={examAId} onValueChange={setExamAId}>
                                <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                                <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name || "Unnamed"}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Secondary Exam (B) <HelpTip text="The second exam in the constraint pair" /></Label>
                            <Select value={examBId} onValueChange={setExamBId}>
                                <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                                <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name || "Unnamed"}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Switch checked={hard} onCheckedChange={setHard} />
                                <Label>Hard Constraint <HelpTip text="Hard constraints MUST be satisfied — the solver will never violate them. Soft constraints incur a penalty but can be violated if necessary." /></Label>
                            </div>
                            {!hard && (
                                <div className="flex items-center gap-2">
                                    <Label>Weight <HelpTip text="Penalty multiplier for violating this soft constraint. Higher weight = solver tries harder to satisfy it." /></Label>
                                    <Input type="number" className="w-20" value={weight} onChange={e => setWeight(parseInt(e.target.value))} min={1} />
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isEditing ? "Save" : "Create"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DeleteDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void; }) {
    const [deleting, setDeleting] = useState(false);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader><DialogTitle>Delete Constraint</DialogTitle><DialogDescription>This action cannot be undone.</DialogDescription></DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button variant="destructive" disabled={deleting} onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false); }}>
                        {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function ConstraintsPage() {
    const { currentSessionId } = useAcademicSession();
    const [constraints, setConstraints] = useState<Constraint[]>([]);
    const [exams, setExams] = useState<ExamOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editConstraint, setEditConstraint] = useState<Constraint | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Constraint | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchData = async (currentPage = page) => {
        setLoading(true);
        try {
            const constraintUrl = currentSessionId 
                ? `/api/constraints?page=${currentPage}&limit=50&sessionId=${currentSessionId}` 
                : `/api/constraints?page=${currentPage}&limit=50`;
            const examUrl = currentSessionId 
                ? `/api/exams?limit=500&sessionId=${currentSessionId}` 
                : "/api/exams?limit=500";
                
            const [cRes, eRes] = await Promise.all([
                fetch(constraintUrl), 
                fetch(examUrl)
            ]);
            
            const cData = await cRes.json();
            const eData = await eRes.json();
            setConstraints(cData.constraints || []);
            setTotalPages(Math.ceil((cData.total || 0) / 50) || 1);
            setExams((eData.exams || []).map((e: any) => ({ id: e.id, name: e.name || "Unnamed" })));
        } catch { toast.error("Failed to load data"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(page); }, [page, currentSessionId]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await fetch(`/api/constraints/${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed");
            toast.success("Constraint deleted"); setDeleteTarget(null); fetchData();
        } catch (err: any) { toast.error(err.message); }
    };

    const filtered = constraints.filter(c => search === "" || c.type.toLowerCase().includes(search.toLowerCase()) || (c.examA.name || "").toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Distribution Constraints</h2>
                <Button onClick={() => { setEditConstraint(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Constraint</Button>
            </div>
            <div className="flex items-center space-x-2 pb-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder="Search constraints..." className="pl-8 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Global Rules</CardTitle>
                    <CardDescription>Manage hard and soft distribution constraints between specific exams.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg">
                            <Settings2 className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="font-semibold text-lg">No constraints found</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">Distribution constraints map rules between two specific exams.</p>
                        </div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader className="bg-muted/5">
                                    <TableRow>
                                        <TableHead className="w-[180px]">Type</TableHead>
                                        <TableHead>Exam A</TableHead>
                                        <TableHead>Exam B</TableHead>
                                        <TableHead className="text-center w-[120px]">Enforcement</TableHead>
                                        <TableHead className="text-right w-[100px]">Weight</TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map(c => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-medium font-mono text-xs">{c.type}</TableCell>
                                            <TableCell>{c.examA.name || "Unnamed"}</TableCell>
                                            <TableCell>{c.examB.name || "Unnamed"}</TableCell>
                                            <TableCell className="text-center">
                                                {c.hard ? (
                                                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">HARD</span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">SOFT</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">{c.hard ? "—" : c.weight}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => { setEditConstraint(c); setFormOpen(true); }}>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(c)}>Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
            <DataPagination page={page} totalPages={totalPages} onPageChange={setPage} />

            <ConstraintDialog constraint={editConstraint} exams={exams} open={formOpen} onOpenChange={setFormOpen} onSaved={() => fetchData(page)} />
            <DeleteDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }} onConfirm={handleDelete} />
        </div>
    );
}
