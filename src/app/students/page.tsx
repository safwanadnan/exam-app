"use client";

import { useEffect, useState } from "react";
import { Plus, Users, Search, MoreHorizontal, Loader2, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { HelpTip, Tip } from "@/components/tip";

interface Student {
    id: string; externalId: string; name: string;
    _count: { enrollments: number };
}

function StudentDialog({ open, onOpenChange, onSaved }: {
    open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [externalId, setExternalId] = useState("");

    useEffect(() => { setName(""); setExternalId(""); }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            const res = await fetch("/api/students", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, externalId }),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
            toast.success("Student created"); onOpenChange(false); onSaved();
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add Student</DialogTitle>
                        <DialogDescription>Enter student details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2"><Label>External ID <HelpTip text="The university student ID (e.g. S12345). Must be unique. Used to match students during data import." /></Label><Input value={externalId} onChange={e => setExternalId(e.target.value)} placeholder="e.g. S12345" required /></div>
                        <div className="grid gap-2"><Label>Name <HelpTip text="Student's full name as it appears in university records" /></Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DeleteDialog({ open, onOpenChange, onConfirm, title }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void; title: string; }) {
    const [deleting, setDeleting] = useState(false);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader><DialogTitle>Delete Student</DialogTitle><DialogDescription>Delete <strong>{title}</strong>? This will also remove all enrollments.</DialogDescription></DialogHeader>
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

export default function StudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");
    const [addOpen, setAddOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

    // Unavailability
    const [showUnavail, setShowUnavail] = useState<Student | null>(null);
    const [periods, setPeriods] = useState<any[]>([]);
    const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    const fetchStudents = async (q = search) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: "50" });
            if (q) params.set("search", q);
            const res = await fetch(`/api/students?${params}`);
            const data = await res.json();
            setStudents(data.students || []); setTotal(data.total || 0);
        } catch { toast.error("Failed to load students"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchStudents(); }, []);

    useEffect(() => {
        const t = setTimeout(() => fetchStudents(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await fetch(`/api/students/${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed"); toast.success("Student deleted");
            setDeleteTarget(null); fetchStudents();
        } catch (err: any) { toast.error(err.message); }
    };

    const openUnavail = async (s: Student) => {
        setShowUnavail(s);
        const [perRes, unRes] = await Promise.all([
            fetch("/api/periods?limit=200").then(r => r.json()),
            fetch(`/api/students/${s.id}/unavailability`).then(r => r.json())
        ]);
        setPeriods(perRes.periods || []);
        setSelectedPeriods((unRes.unavailability || []).map((u: any) => u.periodId));
    };

    const handleSaveUnavail = async () => {
        if (!showUnavail) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/students/${showUnavail.id}/unavailability`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ periodIds: selectedPeriods })
            });
            if (!res.ok) throw new Error("Failed to save unavailability");
            toast.success("Unavailability preferences saved");
            setShowUnavail(null);
        } catch (e: any) { toast.error(e.message); }
        setSaving(false);
    };

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Students</h2>
                <Button onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Student</Button>
            </div>
            <div className="flex items-center space-x-2 pb-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder="Search by name or ID..." className="pl-8 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="text-sm text-muted-foreground">{total} total students</div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Student Directory</CardTitle>
                    <CardDescription>Manage students and their exam enrollments.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : students.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg">
                            <Users className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="font-semibold text-lg">No students found</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">Import data or add students manually.</p>
                        </div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader className="bg-muted/5">
                                    <TableRow>
                                        <TableHead>External ID <HelpTip text="University student ID" /></TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead className="text-right">Enrollments <HelpTip text="Number of exams this student is enrolled in. The solver avoids scheduling conflicting exams for the same student." /></TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.map(s => (
                                        <TableRow key={s.id}>
                                            <TableCell className="font-mono text-sm">{s.externalId}</TableCell>
                                            <TableCell className="font-medium">{s.name}</TableCell>
                                            <TableCell className="text-right">
                                                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">{s._count.enrollments}</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1">
                                                    <Tip content="Manage unavailability gaps"><Button variant="ghost" size="sm" onClick={() => openUnavail(s)}>
                                                        <CalendarOff className="h-4 w-4" />
                                                    </Button></Tip>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(s)}>Delete</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <StudentDialog open={addOpen} onOpenChange={setAddOpen} onSaved={fetchStudents} />
            <DeleteDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }} onConfirm={handleDelete} title={deleteTarget?.name || ""} />

            {/* Unavailability Dialog */}
            <Dialog open={!!showUnavail} onOpenChange={() => setShowUnavail(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Unavailable Periods — {showUnavail?.name}</DialogTitle>
                        <DialogDescription>Select which periods this student is completely unavailable to take exams.</DialogDescription>
                    </DialogHeader>
                    <div className="border rounded-md max-h-64 overflow-y-auto p-2 bg-muted/5 space-y-1 my-4">
                        {periods.map(per => {
                            const dateStr = new Date(per.date).toLocaleDateString();
                            return (
                                <div key={per.id} className="flex items-center space-x-2 p-1.5 hover:bg-muted/50 rounded">
                                    <Switch
                                        checked={selectedPeriods.includes(per.id)}
                                        onCheckedChange={(checked) => {
                                            if (checked) setSelectedPeriods([...selectedPeriods, per.id]);
                                            else setSelectedPeriods(selectedPeriods.filter(id => id !== per.id));
                                        }}
                                    />
                                    <Label className="text-sm font-normal cursor-pointer select-none">
                                        <span className="font-medium text-foreground">{dateStr}</span>
                                        <span className="text-muted-foreground ml-2">{per.startTime} - {per.endTime}</span>
                                    </Label>
                                </div>
                            );
                        })}
                        {periods.length === 0 && <div className="text-sm text-muted-foreground p-2">No periods found.</div>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowUnavail(null)}>Cancel</Button>
                        <Button onClick={handleSaveUnavail} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
