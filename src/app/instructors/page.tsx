"use client";

import { useEffect, useState, useCallback } from "react";
import { GraduationCap, Plus, Pencil, Trash2, Search, Loader2, UserPlus, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { HelpTip, Tip } from "@/components/tip";

interface Instructor {
    id: string; externalId: string; name: string;
    _count: { assignments: number };
    assignments?: { exam: { id: string; name: string; length: number; size: number } }[];
}

export default function InstructorsPage() {
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Dialogs
    const [showAdd, setShowAdd] = useState(false);
    const [editInstructor, setEditInstructor] = useState<Instructor | null>(null);
    const [deleteInstructor, setDeleteInstructor] = useState<Instructor | null>(null);
    const [showAssign, setShowAssign] = useState<Instructor | null>(null);
    const [detailInstructor, setDetailInstructor] = useState<Instructor | null>(null);

    // Form
    const [formName, setFormName] = useState("");
    const [formExtId, setFormExtId] = useState("");
    const [saving, setSaving] = useState(false);

    // Assignment
    const [exams, setExams] = useState<any[]>([]);
    const [selectedExam, setSelectedExam] = useState("");
    const [assignments, setAssignments] = useState<any[]>([]);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const fetchInstructors = useCallback(() => {
        setLoading(true);
        fetch(`/api/instructors?search=${encodeURIComponent(debouncedSearch)}&limit=100`)
            .then(r => r.json())
            .then(d => { setInstructors(d.instructors || []); setTotal(d.total || 0); setLoading(false); })
            .catch(() => setLoading(false));
    }, [debouncedSearch]);

    useEffect(() => { fetchInstructors(); }, [fetchInstructors]);

    // Create / Edit
    const handleSave = async () => {
        if (!formName || !formExtId) { toast.error("All fields required"); return; }
        setSaving(true);
        try {
            const url = editInstructor ? `/api/instructors/${editInstructor.id}` : "/api/instructors";
            const method = editInstructor ? "PUT" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formName, externalId: formExtId }) });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
            toast.success(editInstructor ? "Instructor updated" : "Instructor added");
            setShowAdd(false); setEditInstructor(null);
            fetchInstructors();
        } catch (e: any) { toast.error(e.message); }
        setSaving(false);
    };

    const openEdit = (i: Instructor) => { setFormName(i.name); setFormExtId(i.externalId); setEditInstructor(i); };

    // Delete
    const handleDelete = async () => {
        if (!deleteInstructor) return;
        try {
            const res = await fetch(`/api/instructors/${deleteInstructor.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            toast.success("Instructor deleted");
            setDeleteInstructor(null);
            fetchInstructors();
        } catch (e: any) { toast.error(e.message); }
    };

    // Assignments
    const openAssignments = async (i: Instructor) => {
        setShowAssign(i);
        // Fetch instructor detail (with assignments) and all exams
        const [instrRes, examsRes] = await Promise.all([
            fetch(`/api/instructors/${i.id}`).then(r => r.json()),
            fetch("/api/exams?limit=500").then(r => r.json()),
        ]);
        setDetailInstructor(instrRes);
        setAssignments(instrRes.assignments || []);
        setExams(examsRes.exams || []);
        setSelectedExam("");
    };

    const handleAssign = async () => {
        if (!selectedExam || !showAssign) return;
        try {
            const res = await fetch("/api/instructors/assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ instructorId: showAssign.id, examId: selectedExam }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
            toast.success("Exam assigned");
            openAssignments(showAssign); // refresh
            fetchInstructors();
        } catch (e: any) { toast.error(e.message); }
    };

    const handleUnassign = async (examId: string) => {
        if (!showAssign) return;
        try {
            const res = await fetch(`/api/instructors/assignments?instructorId=${showAssign.id}&examId=${examId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed");
            toast.success("Assignment removed");
            openAssignments(showAssign);
            fetchInstructors();
        } catch (e: any) { toast.error(e.message); }
    };

    const isDialogOpen = showAdd || !!editInstructor;

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Instructors</h2>
                    <p className="text-muted-foreground mt-1">{total} instructor{total !== 1 ? "s" : ""} in system</p>
                </div>
                <Button onClick={() => { setFormName(""); setFormExtId(""); setShowAdd(true); }}>
                    <UserPlus className="mr-2 h-4 w-4" /> Add Instructor
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name or ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : instructors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <GraduationCap className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="font-semibold text-lg">No Instructors Found</h3>
                            <p className="text-sm text-muted-foreground">Add instructors to assign them to exams.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>External ID <HelpTip text="University/institutional ID for this instructor" /></TableHead>
                                    <TableHead>Assigned Exams <HelpTip text="Click the badge to manage which exams this instructor proctors. The solver avoids scheduling their assigned exams at the same time." /></TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {instructors.map(i => (
                                    <TableRow key={i.id}>
                                        <TableCell className="font-medium">{i.name}</TableCell>
                                        <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{i.externalId}</code></TableCell>
                                        <TableCell>
                                            <Badge variant={i._count.assignments > 0 ? "default" : "secondary"} className="cursor-pointer" onClick={() => openAssignments(i)}>
                                                {i._count.assignments} exam{i._count.assignments !== 1 ? "s" : ""}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Tip content="Manage exam assignments"><Button variant="ghost" size="sm" onClick={() => openAssignments(i)}>
                                                    <Link2 className="h-4 w-4" />
                                                </Button></Tip>
                                                <Tip content="Edit instructor details"><Button variant="ghost" size="sm" onClick={() => openEdit(i)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button></Tip>
                                                <Tip content="Delete this instructor"><Button variant="ghost" size="sm" onClick={() => setDeleteInstructor(i)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button></Tip>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Add / Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={() => { setShowAdd(false); setEditInstructor(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editInstructor ? "Edit Instructor" : "Add Instructor"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Name <HelpTip text="Instructor's full name, e.g. 'Dr. Jane Smith' or 'Prof. Ahmed Ali'" /></Label>
                            <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Dr. Jane Smith" />
                        </div>
                        <div className="grid gap-2">
                            <Label>External ID <HelpTip text="Unique institutional ID for this instructor. Used to match during data imports." /></Label>
                            <Input value={formExtId} onChange={e => setFormExtId(e.target.value)} placeholder="INS001" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowAdd(false); setEditInstructor(null); }}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editInstructor ? "Update" : "Add"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm */}
            <Dialog open={!!deleteInstructor} onOpenChange={() => setDeleteInstructor(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Instructor</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{deleteInstructor?.name}</strong>? This will also remove all their exam assignments.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteInstructor(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assignments Dialog */}
            <Dialog open={!!showAssign} onOpenChange={() => setShowAssign(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Exam Assignments — {showAssign?.name}</DialogTitle>
                        <DialogDescription>Assign this instructor to exams for scheduling conflict detection.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Select value={selectedExam} onValueChange={setSelectedExam}>
                                <SelectTrigger className="flex-1"><SelectValue placeholder="Select exam to assign..." /></SelectTrigger>
                                <SelectContent>
                                    {exams
                                        .filter(e => !assignments.some(a => a.exam.id === e.id))
                                        .map(e => <SelectItem key={e.id} value={e.id}>{e.name || "Unnamed"} ({e.size} students)</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Button onClick={handleAssign} disabled={!selectedExam} size="sm">
                                <Plus className="mr-1 h-4 w-4" /> Assign
                            </Button>
                        </div>

                        {assignments.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">No exam assignments yet.</div>
                        ) : (
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Exam</TableHead>
                                            <TableHead>Duration</TableHead>
                                            <TableHead>Students</TableHead>
                                            <TableHead className="w-10"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {assignments.map((a: any) => (
                                            <TableRow key={a.exam.id}>
                                                <TableCell className="font-medium">{a.exam.name || "Unnamed"}</TableCell>
                                                <TableCell>{a.exam.length}min</TableCell>
                                                <TableCell>{a.exam.size}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm" onClick={() => handleUnassign(a.exam.id)}>
                                                        <Unlink className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
