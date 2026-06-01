"use client";

import { useEffect, useState } from "react";
import { Plus, Map, MoreHorizontal, Loader2 } from "lucide-react";
import { SearchInput } from "@/components/search-input";
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

interface CampusData {
    id: string; name: string; code: string;
    _count: { buildings: number };
}

function CampusDialog({ campus, open, onOpenChange, onSaved }: {
    campus?: CampusData | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
    const isEditing = !!campus;
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");

    useEffect(() => {
        if (campus) { setName(campus.name); setCode(campus.code); }
        else { setName(""); setCode(""); }
    }, [campus, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            const body = { name, code };
            const url = isEditing ? `/api/campuses/${campus!.id}` : "/api/campuses";
            const res = await fetch(url, { method: isEditing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
            toast.success(isEditing ? "Campus updated" : "Campus created");
            onOpenChange(false); onSaved();
        } catch (err: unknown) { const message = err instanceof Error ? err.message : String(err); toast.error(message); } finally { setSaving(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-100">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Edit Campus" : "Add Campus"}</DialogTitle>
                        <DialogDescription>Enter the campus details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2"><Label>Name <HelpTip text="Full campus name, e.g. 'Main Campus'" /></Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
                        <div className="grid gap-2"><Label>Code <HelpTip text="Short unique code for this campus, e.g. 'MAIN' or 'DT'" /></Label><Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. MAIN" required /></div>
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

function DeleteDialog({ open, onOpenChange, onConfirm, title }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void; title: string; }) {
    const [deleting, setDeleting] = useState(false);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-100">
                <DialogHeader><DialogTitle>Confirm Delete</DialogTitle><DialogDescription>Are you sure you want to delete <strong>{title}</strong>? This cannot be undone.</DialogDescription></DialogHeader>
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

export default function CampusesPage() {
    const [campuses, setCampuses] = useState<CampusData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [exactMatch, setExactMatch] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    const [campusDialogOpen, setCampusDialogOpen] = useState(false);
    const [editCampus, setEditCampus] = useState<CampusData | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

    const fetchData = async (currentPage = page) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: "50",
                search: debouncedSearch,
                exact: exactMatch ? "true" : "false"
            });
            const res = await fetch(`/api/campuses?${params.toString()}`);
            const data = await res.json();
            setCampuses(data.campuses || []);
            setTotalPages(Math.ceil((data.total || 0) / 50) || 1);
        } catch { toast.error("Failed to load campuses"); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        setPage(1);
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search, exactMatch]);

    useEffect(() => { fetchData(page); }, [page, debouncedSearch]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await fetch(`/api/campuses/${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete campus");
            toast.success("Campus deleted");
            setDeleteTarget(null); fetchData();
        } catch (err: unknown) { const message = err instanceof Error ? err.message : String(err); toast.error(message); }
    };

    const totalBuildings = campuses.reduce((acc, c) => acc + c._count.buildings, 0);

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Campuses</h2>
                <Button onClick={() => { setEditCampus(null); setCampusDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Campus</Button>
            </div>

            <div className="flex items-center space-x-2 pb-2">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    exactMatch={exactMatch}
                    onExactMatchChange={setExactMatch}
                    placeholder="Search campuses..."
                    className="max-w-sm w-full"
                />
                <div className="text-sm text-muted-foreground">{campuses.length} campuses, {totalBuildings} buildings total</div>
            </div>

            <div className="grid gap-6">
                {loading ? (
                    <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : campuses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-surface-soft/20 border border-dashed rounded-lg">
                        <Map className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                        <h3 className="font-semibold text-lg text-foreground">No campuses configured</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mt-1">Add campuses to logically group your buildings and configure travel constraints.</p>
                    </div>
                ) : (
                    <Card className="overflow-hidden">
                        <CardHeader className="bg-surface-soft/10 border-b py-4">
                            <CardTitle className="text-lg">All Campuses</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-surface-soft/5">
                                    <TableRow>
                                        <TableHead className="pl-6 w-[30%]">Campus Name</TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Buildings</TableHead>
                                        <TableHead className="w-20"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {campuses.map(campus => (
                                        <TableRow key={campus.id}>
                                            <TableCell className="pl-6 font-medium flex items-center gap-2">
                                                <Map className="h-4 w-4 text-muted-foreground" /> {campus.name}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{campus.code}</TableCell>
                                            <TableCell className="text-muted-foreground">{campus._count.buildings}</TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => { setEditCampus(campus); setCampusDialogOpen(true); }}>Edit campus</DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ id: campus.id, name: campus.name })}>Delete campus</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
                <DataPagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>

            <CampusDialog campus={editCampus} open={campusDialogOpen} onOpenChange={setCampusDialogOpen} onSaved={() => fetchData(page)} />
            <DeleteDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }} onConfirm={handleDelete} title={deleteTarget?.name || ""} />
        </div>
    );
}
