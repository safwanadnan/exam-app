"use client";

import { useEffect, useState } from "react";
import { Plus, Users, Search, MoreHorizontal, Loader2, CalendarOff, BookOpen, Clock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { HelpTip, Tip } from "@/components/tip";
import { format } from "date-fns";

interface Student {
    id: string; externalId: string; name: string;
    _count: { enrollments: number };
}

interface DetailedStudent {
    id: string; externalId: string; name: string;
    enrollments: {
        exam: {
            id: string; name: string; length: number;
            examType: { name: string };
            assignments?: { period: { date: string; startTime: string; endTime: string } }[];
        }
    }[];
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
                        <div className="grid gap-2"><Label>External ID <HelpTip text="The university student ID (e.g. S12345). Must be unique." /></Label><Input value={externalId} onChange={e => setExternalId(e.target.value)} placeholder="e.g. S12345" required /></div>
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

export default function StudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");
    const [addOpen, setAddOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

    // Detail panel
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailStudent, setDetailStudent] = useState<DetailedStudent | null>(null);

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

    const openDetail = async (student: Student) => {
        setDetailOpen(true);
        setDetailLoading(true);
        try {
            const res = await fetch(`/api/students/${student.id}`);
            const data = await res.json();
            setDetailStudent(data);
        } catch { toast.error("Failed to load student details"); }
        finally { setDetailLoading(false); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await fetch(`/api/students/${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed");
            toast.success("Student deleted");
            setDeleteTarget(null);
            setDetailOpen(false);
            fetchStudents();
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
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Students</h2>
                    <p className="text-muted-foreground text-sm mt-1">Click any row to see enrolled exams and full profile</p>
                </div>
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
                                        <TableHead className="text-right">Enrollments <HelpTip text="Number of exams this student is enrolled in" /></TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.map(s => (
                                        <TableRow key={s.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openDetail(s)}>
                                            <TableCell className="font-mono text-sm">{s.externalId}</TableCell>
                                            <TableCell className="font-medium">{s.name}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={s._count.enrollments > 0 ? "default" : "secondary"}>
                                                    {s._count.enrollments} exam{s._count.enrollments !== 1 ? "s" : ""}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
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

            {/* ── Student Detail Panel ── */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Student Profile
                        </DialogTitle>
                    </DialogHeader>
                    {detailLoading ? (
                        <div className="flex justify-center p-10"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
                    ) : detailStudent ? (
                        <div className="space-y-5">
                            {/* Identity */}
                            <div className="bg-muted/40 rounded-xl p-4 border">
                                <div className="text-xl font-bold">{detailStudent.name}</div>
                                <code className="text-xs bg-background px-2 py-0.5 rounded border mt-1 inline-block">{detailStudent.externalId}</code>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-muted/30 border rounded-lg p-3">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5 mb-1"><BookOpen className="h-3.5 w-3.5" />Enrolled Exams</div>
                                    <div className="text-2xl font-bold">{detailStudent.enrollments.length}</div>
                                </div>
                                <div className="bg-muted/30 border rounded-lg p-3">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5 mb-1"><Clock className="h-3.5 w-3.5" />Total Exam Time</div>
                                    <div className="text-2xl font-bold">
                                        {Math.round(detailStudent.enrollments.reduce((s, e) => s + (e.exam.length || 0), 0) / 60 * 10) / 10}h
                                    </div>
                                </div>
                            </div>

                            {/* Enrolled exams list */}
                            {detailStudent.enrollments.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Enrolled Exams</div>
                                    <div className="border rounded-lg divide-y overflow-hidden">
                                        {detailStudent.enrollments.map((e: any) => {
                                            const scheduled = e.exam.assignments?.[0];
                                            return (
                                                <div key={e.exam.id} className="px-3 py-2.5 hover:bg-muted/30 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium">{e.exam.name || "Unnamed Exam"}</span>
                                                        <Badge variant="outline" className="text-[10px]">{e.exam.examType?.name}</Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                                                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.exam.length}m</span>
                                                        {scheduled ? (
                                                            <span className="text-primary font-medium">
                                                                {format(new Date(scheduled.period.date), "MMM d")} · {scheduled.period.startTime}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground/50 italic">Not yet scheduled</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">Not enrolled in any exams</div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-2 border-t">
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setDetailOpen(false); openUnavail(students.find(s => s.id === detailStudent.id)!); }}>
                                    <CalendarOff className="mr-1.5 h-4 w-4" />Unavailability
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => { setDetailOpen(false); setDeleteTarget(students.find(s => s.id === detailStudent.id)!); }}>
                                    Delete Student
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            <StudentDialog open={addOpen} onOpenChange={setAddOpen} onSaved={fetchStudents} />

            {/* Delete Confirm */}
            <Dialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader><DialogTitle>Delete Student</DialogTitle><DialogDescription>Delete <strong>{deleteTarget?.name}</strong>? This will also remove all enrollments.</DialogDescription></DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Unavailability Dialog */}
            <Dialog open={!!showUnavail} onOpenChange={() => setShowUnavail(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Unavailable Periods — {showUnavail?.name}</DialogTitle>
                        <DialogDescription>Select which periods this student cannot take exams.</DialogDescription>
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
