"use client";

import { useEffect, useState } from "react";
import { Plus, GraduationCap, Search, MoreHorizontal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Exam {
    id: string; name: string; length: number; maxRooms: number; altSeating: boolean;
    examType: { name: string; code: string };
    _count: { studentEnrollments: number; instructorAssignments: number };
}

function ExamDialog({ exam, open, onOpenChange, onSaved }: {
    exam?: Exam | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
    const isEditing = !!exam;
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [length, setLength] = useState(120);
    const [maxRooms, setMaxRooms] = useState(4);
    const [altSeating, setAltSeating] = useState(false);

    useEffect(() => {
        if (exam) { setName(exam.name || ""); setLength(exam.length); setMaxRooms(exam.maxRooms); setAltSeating(exam.altSeating); }
        else { setName(""); setLength(120); setMaxRooms(4); setAltSeating(false); }
    }, [exam, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            const body: any = { name, length, maxRooms, altSeating };
            const url = isEditing ? `/api/exams/${exam!.id}` : "/api/exams";
            if (!isEditing) {
                toast.error("Creating exams requires an exam type. Use the import page for bulk creation.");
                setSaving(false); return;
            }
            const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
            toast.success("Exam updated");
            onOpenChange(false); onSaved();
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Exam</DialogTitle>
                        <DialogDescription>Update exam scheduling parameters.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2"><Label>Exam Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2"><Label>Length (minutes)</Label><Input type="number" value={length} onChange={e => setLength(parseInt(e.target.value))} required /></div>
                            <div className="grid gap-2"><Label>Max Rooms</Label><Input type="number" value={maxRooms} onChange={e => setMaxRooms(parseInt(e.target.value))} required /></div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch checked={altSeating} onCheckedChange={setAltSeating} />
                            <Label>Alternate Seating Required</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
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
                <DialogHeader><DialogTitle>Confirm Delete</DialogTitle><DialogDescription>Delete <strong>{title}</strong>? This cannot be undone.</DialogDescription></DialogHeader>
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

export default function ExamsPage() {
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [editExam, setEditExam] = useState<Exam | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);

    const fetchExams = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/exams?limit=100");
            const data = await res.json();
            setExams(data.exams || []);
        } catch { toast.error("Failed to load exams"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchExams(); }, []);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await fetch(`/api/exams/${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            toast.success("Exam deleted");
            setDeleteTarget(null); fetchExams();
        } catch (err: any) { toast.error(err.message); }
    };

    const filtered = exams.filter(e => search === "" || (e.name || "").toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Exams & Courses</h2>
            </div>

            <div className="flex items-center space-x-2 pb-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder="Search exams..." className="pl-8 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="text-sm text-muted-foreground">{filtered.length} exams</div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Exam Configurations</CardTitle>
                    <CardDescription>Manage exams, scheduling parameters, and seating requirements.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg">
                            <GraduationCap className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="font-semibold text-lg">No exams found</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">Import data or create exams to begin scheduling.</p>
                        </div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader className="bg-muted/5">
                                    <TableRow>
                                        <TableHead>Exam Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Length</TableHead>
                                        <TableHead className="text-right">Enrolled</TableHead>
                                        <TableHead className="text-right">Max Rooms</TableHead>
                                        <TableHead className="text-center">Alt Seating</TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map(exam => (
                                        <TableRow key={exam.id}>
                                            <TableCell className="font-medium">{exam.name || "Unnamed Exam"}</TableCell>
                                            <TableCell>{exam.examType?.name || "—"}</TableCell>
                                            <TableCell className="text-right font-medium">{exam.length}m</TableCell>
                                            <TableCell className="text-right"><span className="font-medium text-primary">{exam._count.studentEnrollments}</span></TableCell>
                                            <TableCell className="text-right text-muted-foreground">{exam.maxRooms}</TableCell>
                                            <TableCell className="text-center">
                                                {exam.altSeating ? (
                                                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">Required</span>
                                                ) : <span className="text-muted-foreground text-xs">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => { setEditExam(exam); setEditOpen(true); }}>Edit exam</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(exam)}>Delete exam</DropdownMenuItem>
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

            <ExamDialog exam={editExam} open={editOpen} onOpenChange={setEditOpen} onSaved={fetchExams} />
            <DeleteDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }} onConfirm={handleDelete} title={deleteTarget?.name || "this exam"} />
        </div>
    );
}
