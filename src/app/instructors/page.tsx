"use client";

import { useEffect, useState, useCallback } from "react";
import {
    GraduationCap, Plus, Pencil, Trash2, Search, Loader2, UserPlus,
    Link2, Unlink, CalendarOff, ExternalLink, BookOpen, Clock, Users, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { HelpTip, Tip } from "@/components/tip";
import { DataPagination } from "@/components/data-pagination";
import { useAcademicSession } from "@/components/academic-session-provider";

interface Instructor {
    id: string; externalId: string; name: string;
    _count: { assignments: number };
    assignments?: { exam: { id: string; name: string; length: number; size: number } }[];
}

interface DetailedInstructor {
    id: string; name: string; externalId: string;
    assignments: { exam: { id: string; name: string; length: number; size: number } }[];
    unavailability?: { period: { id: string; date: string; startTime: string; endTime: string } }[];
}

export default function InstructorsPage() {
    const { currentSessionId } = useAcademicSession();
    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Detail panel
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailInstructor, setDetailInstructor] = useState<DetailedInstructor | null>(null);

    // Dialogs
    const [showAdd, setShowAdd] = useState(false);
    const [editInstructor, setEditInstructor] = useState<Instructor | null>(null);
    const [deleteInstructor, setDeleteInstructor] = useState<Instructor | null>(null);
    const [showAssign, setShowAssign] = useState<Instructor | null>(null);

    // Form
    const [formName, setFormName] = useState("");
    const [formExtId, setFormExtId] = useState("");
    const [saving, setSaving] = useState(false);

    // Assignment
    const [exams, setExams] = useState<any[]>([]);
    const [selectedExam, setSelectedExam] = useState("");
    const [assignments, setAssignments] = useState<any[]>([]);

    // Unavailability
    const [showUnavail, setShowUnavail] = useState<Instructor | null>(null);
    const [periods, setPeriods] = useState<any[]>([]);
    const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);

    useEffect(() => {
        setPage(1);
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const fetchInstructors = useCallback((currentPage = page) => {
        setLoading(true);
        const url = currentSessionId 
            ? `/api/instructors?search=${encodeURIComponent(debouncedSearch)}&page=${currentPage}&limit=50&sessionId=${currentSessionId}` 
            : `/api/instructors?search=${encodeURIComponent(debouncedSearch)}&page=${currentPage}&limit=50`;
        fetch(url)
            .then(r => r.json())
            .then(d => {
                setInstructors(d.instructors || []);
                setTotal(d.total || 0);
                setTotalPages(Math.ceil((d.total || 0) / 50) || 1);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [debouncedSearch, page]);

    useEffect(() => { fetchInstructors(page); }, [fetchInstructors, page, currentSessionId]);

    const openDetail = async (instructor: Instructor) => {
        setDetailOpen(true);
        setDetailLoading(true);
        try {
            const res = await fetch(`/api/instructors/${instructor.id}`);
            const data = await res.json();
            setDetailInstructor(data);
        } catch { toast.error("Failed to load instructor details"); }
        finally { setDetailLoading(false); }
    };

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

    const handleDelete = async () => {
        if (!deleteInstructor) return;
        try {
            const res = await fetch(`/api/instructors/${deleteInstructor.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            toast.success("Instructor deleted");
            setDeleteInstructor(null);
            setDetailOpen(false);
            fetchInstructors();
        } catch (e: any) { toast.error(e.message); }
    };

    const openAssignments = async (i: Instructor) => {
        setShowAssign(i);
        const examUrl = currentSessionId ? `/api/exams?limit=500&sessionId=${currentSessionId}` : "/api/exams?limit=500";
        const [instrRes, examsRes] = await Promise.all([
            fetch(`/api/instructors/${i.id}`).then(r => r.json()),
            fetch(examUrl).then(r => r.json()),
        ]);
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
            openAssignments(showAssign);
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

    const openUnavail = async (i: Instructor) => {
        setShowUnavail(i);
        const url = currentSessionId ? `/api/periods?limit=200&sessionId=${currentSessionId}` : "/api/periods?limit=200";
        const [perRes, unRes] = await Promise.all([
            fetch(url).then(r => r.json()),
            fetch(`/api/instructors/${i.id}/unavailability`).then(r => r.json())
        ]);
        setPeriods(perRes.periods || []);
        setSelectedPeriods((unRes.unavailability || []).map((u: any) => u.periodId));
    };

    const handleSaveUnavail = async () => {
        if (!showUnavail) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/instructors/${showUnavail.id}/unavailability`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ periodIds: selectedPeriods })
            });
            if (!res.ok) throw new Error("Failed to save unavailability");
            toast.success("Unavailability preferences saved");
            setShowUnavail(null);
        } catch (e: any) { toast.error(e.message); }
        setSaving(false);
    };

    const isFormOpen = showAdd || !!editInstructor;

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Instructors</h2>
                    <p className="text-muted-foreground mt-1">{total} instructor{total !== 1 ? "s" : ""} — click any row to see details</p>
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
                                    <TableHead>Assigned Exams <HelpTip text="Number of exams this instructor proctors" /></TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {instructors.map(i => (
                                    <TableRow
                                        key={i.id}
                                        className="cursor-pointer hover:bg-muted/40"
                                        onClick={() => openDetail(i)}
                                    >
                                        <TableCell className="font-medium">{i.name}</TableCell>
                                        <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{i.externalId}</code></TableCell>
                                        <TableCell>
                                            <Badge variant={i._count.assignments > 0 ? "default" : "secondary"}>
                                                {i._count.assignments} exam{i._count.assignments !== 1 ? "s" : ""}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                                                <Tip content="Manage unavailability gaps"><Button variant="ghost" size="sm" onClick={() => openUnavail(i)}>
                                                    <CalendarOff className="h-4 w-4" />
                                                </Button></Tip>
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
            <DataPagination page={page} totalPages={totalPages} onPageChange={setPage} />

            {/* ── Detail Panel ── */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5" />
                            Instructor Profile
                        </DialogTitle>
                    </DialogHeader>
                    {detailLoading ? (
                        <div className="flex justify-center p-10"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
                    ) : detailInstructor ? (
                        <div className="space-y-5">
                            {/* Identity */}
                            <div className="bg-muted/40 rounded-xl p-4 border space-y-2">
                                <div className="text-xl font-bold">{detailInstructor.name}</div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <code className="bg-background px-2 py-0.5 rounded text-xs border">{detailInstructor.externalId}</code>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-muted/30 border rounded-lg p-3 space-y-0.5">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />Assigned Exams</div>
                                    <div className="text-2xl font-bold">{detailInstructor.assignments.length}</div>
                                </div>
                                <div className="bg-muted/30 border rounded-lg p-3 space-y-0.5">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Total Students</div>
                                    <div className="text-2xl font-bold">{detailInstructor.assignments.reduce((s, a) => s + (a.exam.size || 0), 0)}</div>
                                </div>
                            </div>

                            {/* Exam list */}
                            {detailInstructor.assignments.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Assigned Exams</div>
                                    <div className="border rounded-lg divide-y overflow-hidden">
                                        {detailInstructor.assignments.map((a: any) => (
                                            <div key={a.exam.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors">
                                                <div>
                                                    <div className="text-sm font-medium">{a.exam.name || "Unnamed Exam"}</div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                                        <Clock className="h-3 w-3" />{a.exam.length}m
                                                        <span className="opacity-40">·</span>
                                                        <Users className="h-3 w-3" />{a.exam.size} students
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">No exams assigned yet</div>
                            )}

                            {/* Quick Actions */}
                            <div className="flex gap-2 pt-2 border-t">
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setDetailOpen(false); openAssignments(instructors.find(i => i.id === detailInstructor.id)!); }}>
                                    <Link2 className="mr-1.5 h-4 w-4" />Manage Assignments
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setDetailOpen(false); openUnavail(instructors.find(i => i.id === detailInstructor.id)!); }}>
                                    <CalendarOff className="mr-1.5 h-4 w-4" />Unavailability
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); openEdit(instructors.find(i => i.id === detailInstructor.id)!); }}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Add / Edit Dialog */}
            <Dialog open={isFormOpen} onOpenChange={() => { setShowAdd(false); setEditInstructor(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editInstructor ? "Edit Instructor" : "Add Instructor"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Name <HelpTip text="Instructor's full name" /></Label>
                            <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Dr. Jane Smith" />
                        </div>
                        <div className="grid gap-2">
                            <Label>External ID <HelpTip text="Unique institutional ID for this instructor" /></Label>
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

            {/* Unavailability Dialog */}
            <Dialog open={!!showUnavail} onOpenChange={() => setShowUnavail(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Unavailable Periods — {showUnavail?.name}</DialogTitle>
                        <DialogDescription>Select which periods this instructor cannot proctor exams.</DialogDescription>
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
