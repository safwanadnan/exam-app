"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Plus, MoreHorizontal, Calendar, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { HelpTip, Tip } from "@/components/tip";
import { DataPagination } from "@/components/data-pagination";

interface Session {
    id: string;
    name: string;
    year: number;
    term: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    _count: { examTypes: number; solverRuns: number };
}

function SessionFormDialog({
    session,
    open,
    onOpenChange,
    onSaved,
}: {
    session?: Session | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}) {
    const isEditing = !!session;
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [year, setYear] = useState(new Date().getFullYear());
    const [term, setTerm] = useState("Fall");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        if (session) {
            setName(session.name);
            setYear(session.year);
            setTerm(session.term);
            setStartDate(session.startDate.split("T")[0]);
            setEndDate(session.endDate.split("T")[0]);
            setIsActive(session.isActive);
        } else {
            setName("");
            setYear(new Date().getFullYear());
            setTerm("Fall");
            setStartDate("");
            setEndDate("");
            setIsActive(false);
        }
    }, [session, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const body = {
                name,
                year,
                term,
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
                isActive,
            };
            const url = isEditing ? `/api/sessions/${session!.id}` : "/api/sessions";
            const method = isEditing ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to save session");
            }
            toast.success(isEditing ? "Session updated" : "Session created");
            onOpenChange(false);
            onSaved();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Edit Session" : "Create Session"}</DialogTitle>
                        <DialogDescription>
                            {isEditing ? "Update the session details." : "Add a new academic session."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Session Name <HelpTip text="A descriptive label for this academic period, e.g. 'Fall 2026' or 'Summer Term 2025'" /></Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Fall 2026" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="term">Term <HelpTip text="Semester type: Fall, Spring, Summer, or Winter" /></Label>
                                <Input id="term" value={term} onChange={e => setTerm(e.target.value)} placeholder="Fall" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="year">Year <HelpTip text="Academic year this session belongs to" /></Label>
                                <Input id="year" type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} required />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="startDate">Start Date <HelpTip text="First day of the semester — exams can be scheduled from this date" /></Label>
                                <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="endDate">End Date <HelpTip text="Last day of the semester — final date for exam scheduling" /></Label>
                                <Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                            <Label htmlFor="isActive">Active Session <HelpTip text="Mark as active to use this session for exam scheduling. Only one session should be active at a time." /></Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditing ? "Save Changes" : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DeleteConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    title,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    title: string;
}) {
    const [deleting, setDeleting] = useState(false);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Delete Session</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete <strong>{title}</strong>? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        variant="destructive"
                        disabled={deleting}
                        onClick={async () => {
                            setDeleting(true);
                            await onConfirm();
                            setDeleting(false);
                        }}
                    >
                        {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [formOpen, setFormOpen] = useState(false);
    const [editSession, setEditSession] = useState<Session | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchSessions = async (currentPage = page) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: "50",
                search: debouncedSearch
            });
            const res = await fetch(`/api/sessions?${params.toString()}`);
            const data = await res.json();
            setSessions(data.sessions || []);
            setTotalPages(Math.ceil((data.total || 0) / 50) || 1);
        } catch {
            toast.error("Failed to load sessions");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1);
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => { fetchSessions(page); }, [page, debouncedSearch]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await fetch(`/api/sessions/${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            toast.success("Session deleted");
            setDeleteTarget(null);
            fetchSessions();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Academic Sessions</h2>
                <Tip content="Create a new academic session for exam scheduling">
                    <Button onClick={() => { setEditSession(null); setFormOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Add Session
                    </Button>
                </Tip>
            </div>

            <div className="flex items-center space-x-2 pb-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        type="search" 
                        placeholder="Search sessions..." 
                        className="pl-8 bg-background" 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Configured Terms</CardTitle>
                    <CardDescription>
                        Manage academic sessions (terms/semesters) for exam scheduling.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg">
                            <Calendar className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="font-semibold text-lg text-foreground">No sessions yet</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">
                                Create a session to get started with scheduling.
                            </p>
                            <Button className="mt-6" variant="outline" onClick={() => { setEditSession(null); setFormOpen(true); }}>
                                <Plus className="mr-2 h-4 w-4" /> Create Session
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Session Name</TableHead>
                                    <TableHead>Term & Year</TableHead>
                                    <TableHead>Dates</TableHead>
                                    <TableHead className="text-right">Exam Types <HelpTip text="Number of exam types (e.g. Final, Midterm) configured for this session" /></TableHead>
                                    <TableHead className="text-right">Solver Runs <HelpTip text="How many times the optimizer has been executed for this session" /></TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sessions.map((session) => (
                                    <TableRow key={session.id}>
                                        <TableCell className="font-medium">{session.name}</TableCell>
                                        <TableCell>
                                            {session.term} {session.year}
                                            {session.isActive && (
                                                <span className="ml-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
                                                    Active
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {format(new Date(session.startDate), "MMM d")} - {format(new Date(session.endDate), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{session._count.examTypes}</TableCell>
                                        <TableCell className="text-right font-medium">{session._count.solverRuns}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => { setEditSession(session); setFormOpen(true); }}>
                                                        Edit session
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                                                        onClick={() => setDeleteTarget(session)}
                                                    >
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
            <DataPagination page={page} totalPages={totalPages} onPageChange={setPage} />

            <SessionFormDialog
                session={editSession}
                open={formOpen}
                onOpenChange={setFormOpen}
                onSaved={() => fetchSessions(page)}
            />

            <DeleteConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
                onConfirm={handleDelete}
                title={deleteTarget?.name || ""}
            />
        </div>
    );
}
