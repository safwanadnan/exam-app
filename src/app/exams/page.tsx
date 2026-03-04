"use client";

import { useEffect, useState } from "react";
import { Plus, GraduationCap, Search, MoreHorizontal, Loader2, Tags, Users, Clock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { HelpTip, Tip } from "@/components/tip";

interface Exam {
    id: string; name: string; length: number; maxRooms: number; altSeating: boolean;
    examType: { name: string; code: string };
    _count: { studentEnrollments: number; instructorAssignments: number };
    owners?: { section: { sectionNumber: string; course: { courseNumber: string; subjectId: string } } }[];
    instructorAssignments?: { instructor: { name: string } }[];
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
    const [sections, setSections] = useState<any[]>([]);
    const [selectedSections, setSelectedSections] = useState<string[]>([]);

    useEffect(() => {
        if (open) {
            fetch("/api/courses").then(r => r.json()).then(cData => {
                const courseMap = new Map((cData.courses || []).map((c: any) => [c.id, c]));
                fetch("/api/sections").then(r => r.json()).then(sData => {
                    const enhanced = (sData.sections || []).map((s: any) => ({
                        ...s, course: courseMap.get(s.courseId)
                    })).filter((s: any) => s.course);
                    setSections(enhanced);
                });
            });

            if (exam) {
                setName(exam.name || ""); setLength(exam.length); setMaxRooms(exam.maxRooms); setAltSeating(exam.altSeating);
                fetch(`/api/exams/${exam.id}/owners`).then(r => r.json()).then(data => {
                    setSelectedSections((data.owners || []).map((o: any) => o.sectionId));
                });
            } else {
                setName(""); setLength(120); setMaxRooms(4); setAltSeating(false); setSelectedSections([]);
            }
        }
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

            // Save Owners if editing
            if (isEditing) {
                await fetch(`/api/exams/${exam!.id}/owners`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sectionIds: selectedSections })
                });
            }

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
                        <div className="grid gap-2"><Label>Exam Name <HelpTip text="The name of this exam, typically the course code and title" /></Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2"><Label>Length (minutes) <HelpTip text="How long the exam takes. The solver ensures the exam fits within the assigned period." /></Label><Input type="number" value={length} onChange={e => setLength(parseInt(e.target.value))} required /></div>
                            <div className="grid gap-2"><Label>Max Rooms <HelpTip text="Maximum number of rooms the exam can be split across. Large exams may need 2-4 rooms. Set to 1 to force single room." /></Label><Input type="number" value={maxRooms} onChange={e => setMaxRooms(parseInt(e.target.value))} required /></div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch checked={altSeating} onCheckedChange={setAltSeating} />
                            <Label>Alternate Seating Required <HelpTip text="When enabled, room capacity is calculated using the alternate (spaced) layout — typically half the normal capacity. Use for exams needing extra spacing between students." /></Label>
                        </div>
                        {isEditing && (
                            <div className="grid gap-2 border-t pt-4 mt-2">
                                <Label>Exam Owners (Sections) <HelpTip text="Attach course sections to this exam. Students enrolled in these sections will automatically be placed into this exam." /></Label>
                                <div className="border rounded-md max-h-48 overflow-y-auto p-2 bg-muted/5 space-y-1">
                                    {sections.map(sec => (
                                        <div key={sec.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded">
                                            <Switch
                                                checked={selectedSections.includes(sec.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) setSelectedSections([...selectedSections, sec.id]);
                                                    else setSelectedSections(selectedSections.filter(id => id !== sec.id));
                                                }}
                                            />
                                            <Label className="text-sm font-normal cursor-pointer select-none">
                                                {sec.course.subjectId && <span className="text-muted-foreground mr-1">Subject | </span>}
                                                <span className="font-semibold">{sec.course.courseNumber}</span> - Section {sec.sectionNumber}
                                            </Label>
                                        </div>
                                    ))}
                                    {sections.length === 0 && <div className="text-xs text-muted-foreground italic p-2">No sections available to attach.</div>}
                                </div>
                            </div>
                        )}
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

    // Features
    const [showFeatures, setShowFeatures] = useState<Exam | null>(null);
    const [features, setFeatures] = useState<any[]>([]);
    const [preferences, setPreferences] = useState<{ id: string; penalty: number }[]>([]);
    const [savingFeatures, setSavingFeatures] = useState(false);

    // Detail panel
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailExam, setDetailExam] = useState<Exam | null>(null);

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

    const openFeatures = async (e: Exam) => {
        setShowFeatures(e);
        const [featRes, prefRes] = await Promise.all([
            fetch("/api/features?limit=100").then(r => r.json()),
            fetch(`/api/exams/${e.id}/features`).then(r => r.json())
        ]);
        setFeatures(featRes.features || []);
        setPreferences((prefRes.preferences || []).map((p: any) => ({ id: p.featureId, penalty: p.penalty })));
    };

    const handleFeatureChange = (featureId: string, penalty: string) => {
        if (penalty === "0") {
            setPreferences(preferences.filter(p => p.id !== featureId));
        } else {
            const numPenalty = parseInt(penalty);
            if (preferences.some(p => p.id === featureId)) {
                setPreferences(preferences.map(p => p.id === featureId ? { ...p, penalty: numPenalty } : p));
            } else {
                setPreferences([...preferences, { id: featureId, penalty: numPenalty }]);
            }
        }
    };

    const handleSaveFeatures = async () => {
        if (!showFeatures) return;
        setSavingFeatures(true);
        try {
            const res = await fetch(`/api/exams/${showFeatures.id}/features`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ features: preferences })
            });
            if (!res.ok) throw new Error("Failed to save feature preferences");
            toast.success("Exam feature preferences saved");
            setShowFeatures(null);
        } catch (e: any) { toast.error(e.message); }
        setSavingFeatures(false);
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
                                        <TableRow key={exam.id} className="cursor-pointer hover:bg-muted/40" onClick={() => { setDetailExam(exam); setDetailOpen(true); }}>
                                            <TableCell className="font-medium">{exam.name || "Unnamed Exam"}</TableCell>
                                            <TableCell><Badge variant="outline" className="text-[11px]">{exam.examType?.name || "—"}</Badge></TableCell>
                                            <TableCell className="text-right font-medium">{exam.length}m</TableCell>
                                            <TableCell className="text-right"><span className="font-medium text-primary">{exam._count.studentEnrollments}</span></TableCell>
                                            <TableCell className="text-right text-muted-foreground">{exam.maxRooms}</TableCell>
                                            <TableCell className="text-center">
                                                {exam.altSeating ? (
                                                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">Required</span>
                                                ) : <span className="text-muted-foreground text-xs">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                                                    <Tip content="Room Feature Requirements"><Button variant="ghost" size="sm" onClick={() => openFeatures(exam)}>
                                                        <Tags className="h-4 w-4" />
                                                    </Button></Tip>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => { setEditExam(exam); setEditOpen(true); }}>Edit exam</DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(exam)}>Delete exam</DropdownMenuItem>
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

            <ExamDialog exam={editExam} open={editOpen} onOpenChange={setEditOpen} onSaved={fetchExams} />
            <DeleteDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }} onConfirm={handleDelete} title={deleteTarget?.name || "this exam"} />

            {/* ── Exam Detail Panel ── */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" />Exam Details</DialogTitle>
                    </DialogHeader>
                    {detailExam && (
                        <div className="space-y-5">
                            <div className="bg-muted/40 rounded-xl p-4 border">
                                <div className="text-xl font-bold">{detailExam.name || "Unnamed Exam"}</div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge variant="outline">{detailExam.examType?.name}</Badge>
                                    {detailExam.altSeating && <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-400/30">Alt Seating</Badge>}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-muted/30 border rounded-lg p-3">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1 mb-1"><Clock className="h-3 w-3" />Duration</div>
                                    <div className="text-2xl font-bold">{detailExam.length}m</div>
                                </div>
                                <div className="bg-muted/30 border rounded-lg p-3">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1 mb-1"><Users className="h-3 w-3" />Students</div>
                                    <div className="text-2xl font-bold">{detailExam._count.studentEnrollments}</div>
                                </div>
                                <div className="bg-muted/30 border rounded-lg p-3">
                                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">Max Rooms</div>
                                    <div className="text-2xl font-bold">{detailExam.maxRooms}</div>
                                </div>
                            </div>

                            {/* Instructors */}
                            <div className="space-y-1.5">
                                <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Instructors</div>
                                {(detailExam.instructorAssignments || []).length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {detailExam.instructorAssignments!.map((ia, i) => (
                                            <span key={i} className="text-sm bg-muted px-2.5 py-1 rounded-md border">{ia.instructor.name}</span>
                                        ))}
                                    </div>
                                ) : <p className="text-sm text-muted-foreground italic">No instructors assigned</p>}
                            </div>

                            {/* Course Sections */}
                            <div className="space-y-1.5">
                                <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />Course Sections</div>
                                {(detailExam.owners || []).length > 0 ? (
                                    <div className="border rounded-lg divide-y overflow-hidden">
                                        {detailExam.owners!.map((o, i) => (
                                            <div key={i} className="px-3 py-2 text-sm">
                                                <span className="font-medium">{o.section.course.subjectId} {o.section.course.courseNumber}</span>
                                                <span className="text-muted-foreground ml-2">Section {o.section.sectionNumber}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-sm text-muted-foreground italic">No sections attached</p>}
                            </div>

                            <div className="flex gap-2 pt-2 border-t">
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setDetailOpen(false); setEditExam(detailExam); setEditOpen(true); }}>
                                    Edit Exam
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); openFeatures(detailExam); }}>
                                    <Tags className="h-4 w-4 mr-1" />Features
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => { setDetailOpen(false); setDeleteTarget(detailExam); }}>
                                    Delete
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Feature Preferences Dialog */}
            <Dialog open={!!showFeatures} onOpenChange={() => setShowFeatures(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Room Features — {showFeatures?.name}</DialogTitle>
                        <DialogDescription>Require or prefer specific room equipment properties for this exam.</DialogDescription>
                    </DialogHeader>
                    <div className="border rounded-md max-h-64 overflow-y-auto p-2 bg-muted/5 space-y-1 my-4">
                        {features.map(feat => {
                            const pref = preferences.find(p => p.id === feat.id);
                            const val = pref ? pref.penalty.toString() : "0";
                            return (
                                <div key={feat.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                                    <Label className="text-sm font-medium">
                                        {feat.name} <span className="text-muted-foreground ml-1 font-normal text-xs">({feat.code})</span>
                                    </Label>
                                    <Select value={val} onValueChange={(v) => handleFeatureChange(feat.id, v)}>
                                        <SelectTrigger className="w-[180px] h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">Not Required</SelectItem>
                                            <SelectItem value="1">Preferred</SelectItem>
                                            <SelectItem value="2">Strongly Preferred</SelectItem>
                                            <SelectItem value="-1" className="text-amber-600 font-medium">Required (Must Have)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            );
                        })}
                        {features.length === 0 && <div className="text-sm text-muted-foreground p-2 text-center">No features exist in the system. <br /> Create them in the Room Features menu.</div>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowFeatures(null)}>Cancel</Button>
                        <Button onClick={handleSaveFeatures} disabled={savingFeatures}>{savingFeatures && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
