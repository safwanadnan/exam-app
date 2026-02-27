"use client";

import { useEffect, useState } from "react";
import { Plus, Search, MoreHorizontal, Loader2, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { HelpTip } from "@/components/tip";

interface Feature {
    id: string; name: string; code: string;
}

function FeatureDialog({ open, onOpenChange, onSaved, sessionId }: {
    open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void; sessionId: string;
}) {
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");

    useEffect(() => { setName(""); setCode(""); }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            const res = await fetch("/api/features", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, code, sessionId }),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
            toast.success("Feature created"); onOpenChange(false); onSaved();
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add Room Feature</DialogTitle>
                        <DialogDescription>Create a new equipment or property tag for rooms.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2"><Label>Name <HelpTip text="e.g. Projector, Science Lab, Mac Computers" /></Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
                        <div className="grid gap-2"><Label>Code <HelpTip text="Short abbreviation, e.g. PROJ, LAB" /></Label><Input value={code} onChange={e => setCode(e.target.value)} required /></div>
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

export default function FeaturesPage() {
    const [features, setFeatures] = useState<Feature[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState("");
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [addOpen, setAddOpen] = useState(false);

    useEffect(() => {
        fetch("/api/sessions").then(r => r.json()).then(data => {
            setSessions(data.sessions || []);
            const active = data.sessions?.find((s: any) => s.isActive);
            if (active) setSelectedSessionId(active.id);
            else if (data.sessions?.length) setSelectedSessionId(data.sessions[0].id);
        });
    }, []);

    const fetchFeatures = async () => {
        if (!selectedSessionId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/features?sessionId=${selectedSessionId}`);
            const data = await res.json();
            setFeatures(data.features || []);
        } catch { toast.error("Failed to load features"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchFeatures(); }, [selectedSessionId]);

    const filtered = features.filter(f => search === "" || f.name.toLowerCase().includes(search.toLowerCase()) || f.code.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Room Features</h2>
                    <p className="text-muted-foreground mt-1">Define equipment and properties available in rooms.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select session" /></SelectTrigger>
                        <SelectContent>{sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button onClick={() => setAddOpen(true)} disabled={!selectedSessionId}><Plus className="mr-2 h-4 w-4" /> Add Feature</Button>
                </div>
            </div>
            <div className="flex items-center space-x-2 pb-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder="Search features..." className="pl-8 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg m-4">
                            <Tags className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="font-semibold text-lg">No features found</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">Add features like "Projector" or "Computers" to assign them to rooms.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Name</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map(f => (
                                    <TableRow key={f.id}>
                                        <TableCell className="font-mono text-sm">{f.code}</TableCell>
                                        <TableCell className="font-medium">{f.name}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <FeatureDialog open={addOpen} onOpenChange={setAddOpen} onSaved={fetchFeatures} sessionId={selectedSessionId} />
        </div>
    );
}
