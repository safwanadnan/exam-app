"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Plus, Clock, Search, MoreHorizontal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { HelpTip } from "@/components/tip";
import { DataPagination } from "@/components/data-pagination";
import { useAcademicSession } from "@/components/academic-session-provider";

interface Period {
    id: string; date: string; startTime: string; endTime: string;
    length: number; penalty: number; day: number; timeIndex: number;
    examTypeId: string;
    examType: { name: string; code: string };
    _count: { examAssignments: number };
}

function PeriodDialog({ period, open, onOpenChange, onSaved }: {
    period?: Period | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
    const isEditing = !!period;
    const [saving, setSaving] = useState(false);
    const [date, setDate] = useState("");
    const [startTime, setStartTime] = useState("08:00");
    const [endTime, setEndTime] = useState("10:00");
    const [length, setLength] = useState(120);
    const [penalty, setPenalty] = useState(0);

    useEffect(() => {
        if (period) {
            setDate(period.date.split("T")[0]); setStartTime(period.startTime);
            setEndTime(period.endTime); setLength(period.length); setPenalty(period.penalty);
        } else { setDate(""); setStartTime("08:00"); setEndTime("10:00"); setLength(120); setPenalty(0); }
    }, [period, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            if (!isEditing) {
                toast.error("Creating periods requires an exam type. Use the import page for bulk creation.");
                setSaving(false); return;
            }
            const body = { date: new Date(date).toISOString(), startTime, endTime, length, penalty };
            const res = await fetch(`/api/periods/${period!.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
            toast.success("Period updated"); onOpenChange(false); onSaved();
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Period</DialogTitle>
                        <DialogDescription>Update this exam period's scheduling parameters.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2"><Label>Date <HelpTip text="The calendar date for this exam period" /></Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2"><Label>Start Time <HelpTip text="When this exam period begins (24-hour format)" /></Label><Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required /></div>
                            <div className="grid gap-2"><Label>End Time <HelpTip text="When this exam period ends" /></Label><Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2"><Label>Duration (min) <HelpTip text="Maximum allowed exam length during this period. Exams shorter than this will still end when finished." /></Label><Input type="number" value={length} onChange={e => setLength(parseInt(e.target.value))} required /></div>
                            <div className="grid gap-2"><Label>Penalty Weight <HelpTip text="A penalty score added when exams are placed in this period. Use higher values to discourage late evening or weekend slots (0 = no penalty)." /></Label><Input type="number" value={penalty} onChange={e => setPenalty(parseInt(e.target.value))} /></div>
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
                <DialogHeader><DialogTitle>Delete Period</DialogTitle><DialogDescription>Delete <strong>{title}</strong>? This cannot be undone.</DialogDescription></DialogHeader>
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

export default function PeriodsPage() {
    const { currentSessionId } = useAcademicSession();
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [editPeriod, setEditPeriod] = useState<Period | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Period | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchPeriods = async (currentPage = page) => {
        setLoading(true);
        try {
            const url = currentSessionId 
                ? `/api/periods?page=${currentPage}&limit=50&sessionId=${currentSessionId}` 
                : `/api/periods?page=${currentPage}&limit=50`;
            const res = await fetch(url);
            const data = await res.json();
            setPeriods(data.periods || []);
            setTotalPages(Math.ceil((data.total || 0) / 50) || 1);
        } catch { toast.error("Failed to load periods"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchPeriods(page); }, [page, currentSessionId]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await fetch(`/api/periods/${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed"); toast.success("Period deleted");
            setDeleteTarget(null); fetchPeriods();
        } catch (err: any) { toast.error(err.message); }
    };

    const filtered = periods.filter(p => search === "" || p.startTime.includes(search) || p.examType.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Exam Periods</h2>
            </div>
            <div className="flex items-center space-x-2 pb-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder="Search periods..." className="pl-8 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="text-sm text-muted-foreground">{periods.length} periods</div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Time Slots Overview</CardTitle>
                    <CardDescription>Manage available time periods and their penalty weights for the solver.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg">
                            <Clock className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="font-semibold text-lg">No periods configured</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">Configure exam periods to define when exams can be scheduled.</p>
                        </div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader className="bg-muted/5">
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Duration</TableHead>
                                        <TableHead>Exam Type</TableHead>
                                        <TableHead className="text-right">Penalty</TableHead>
                                        <TableHead className="text-right">Assignments</TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map(period => (
                                        <TableRow key={period.id}>
                                            <TableCell className="font-medium">{format(new Date(period.date), "EEE, MMM d, yyyy")}</TableCell>
                                            <TableCell><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />{period.startTime} - {period.endTime}</div></TableCell>
                                            <TableCell className="text-muted-foreground">{period.length} min</TableCell>
                                            <TableCell>{period.examType.name}</TableCell>
                                            <TableCell className="text-right">
                                                {period.penalty === 0 ? <span className="text-muted-foreground">—</span> : (
                                                    <span className={period.penalty > 0 ? "text-destructive font-medium" : "text-emerald-600 font-medium"}>
                                                        {period.penalty > 0 ? "+" : ""}{period.penalty}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">{period._count.examAssignments}</span>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => { setEditPeriod(period); setEditOpen(true); }}>Edit period</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(period)}>Delete period</DropdownMenuItem>
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
            <PeriodDialog period={editPeriod} open={editOpen} onOpenChange={setEditOpen} onSaved={() => fetchPeriods(page)} />
            <DeleteDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }} onConfirm={handleDelete} title={deleteTarget ? `${deleteTarget.startTime} on ${format(new Date(deleteTarget.date), "MMM d")}` : ""} />
        </div>
    );
}
