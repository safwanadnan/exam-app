"use client";

import { useEffect, useState } from "react";
import { Plus, Building2, Search, MoreHorizontal, Loader2, CalendarOff, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { HelpTip, Tip } from "@/components/tip";
import { DataPagination } from "@/components/data-pagination";

interface Room {
    id: string; name: string; capacity: number; altCapacity: number | null;
    coordX: number | null; coordY: number | null; buildingId: string;
}
interface BuildingData {
    id: string; name: string; code: string;
    rooms: Room[]; _count: { rooms: number };
}

function BuildingDialog({ building, open, onOpenChange, onSaved }: {
    building?: BuildingData | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
    const isEditing = !!building;
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");

    useEffect(() => {
        if (building) { setName(building.name); setCode(building.code); }
        else { setName(""); setCode(""); }
    }, [building, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            const body = { name, code };
            const url = isEditing ? `/api/buildings/${building!.id}` : "/api/buildings";
            const res = await fetch(url, { method: isEditing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
            toast.success(isEditing ? "Building updated" : "Building created");
            onOpenChange(false); onSaved();
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Edit Building" : "Add Building"}</DialogTitle>
                        <DialogDescription>Enter the building details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2"><Label>Name <HelpTip text="Full building name, e.g. 'Engineering Science Building'" /></Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
                        <div className="grid gap-2"><Label>Code <HelpTip text="Short unique code for this building, e.g. 'ESB' or 'SCI'. Used in schedule views." /></Label><Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. SCI" required /></div>
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

function RoomDialog({ room, buildings, open, onOpenChange, onSaved }: {
    room?: Room | null; buildings: BuildingData[]; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
    const isEditing = !!room;
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [buildingId, setBuildingId] = useState("");
    const [capacity, setCapacity] = useState(30);
    const [altCapacity, setAltCapacity] = useState("");
    const [coordX, setCoordX] = useState("");
    const [coordY, setCoordY] = useState("");

    useEffect(() => {
        if (room) {
            setName(room.name); setBuildingId(room.buildingId); setCapacity(room.capacity);
            setAltCapacity(room.altCapacity?.toString() || ""); setCoordX(room.coordX?.toString() || ""); setCoordY(room.coordY?.toString() || "");
        } else {
            setName(""); setBuildingId(buildings[0]?.id || ""); setCapacity(30); setAltCapacity(""); setCoordX(""); setCoordY("");
        }
    }, [room, open, buildings]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            const body: any = { name, buildingId, capacity };
            if (altCapacity) body.altCapacity = parseInt(altCapacity);
            if (coordX) body.coordX = parseFloat(coordX);
            if (coordY) body.coordY = parseFloat(coordY);
            const url = isEditing ? `/api/rooms/${room!.id}` : "/api/rooms";
            const res = await fetch(url, { method: isEditing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
            toast.success(isEditing ? "Room updated" : "Room created");
            onOpenChange(false); onSaved();
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Edit Room" : "Add Room"}</DialogTitle>
                        <DialogDescription>Configure room details and seating capacity.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Building <HelpTip text="Select which building this room belongs to" /></Label>
                            <Select value={buildingId} onValueChange={setBuildingId}>
                                <SelectTrigger><SelectValue placeholder="Select building" /></SelectTrigger>
                                <SelectContent>{buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2"><Label>Room Name <HelpTip text="Room number or name within the building, e.g. '101' or 'Auditorium A'" /></Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 101" required /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2"><Label>Capacity <HelpTip text="Normal seating capacity — the maximum number of students this room can hold" /></Label><Input type="number" value={capacity} onChange={e => setCapacity(parseInt(e.target.value))} required /></div>
                            <div className="grid gap-2"><Label>Alt Capacity <HelpTip text="Alternate seating capacity for exams requiring spaced seating (e.g. every other seat). Leave blank if same as normal." /></Label><Input type="number" value={altCapacity} onChange={e => setAltCapacity(e.target.value)} placeholder="Optional" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2"><Label>Coord X <HelpTip text="GPS longitude or campus X coordinate — used to calculate walking distance between rooms for back-to-back penalties" /></Label><Input type="number" step="any" value={coordX} onChange={e => setCoordX(e.target.value)} placeholder="Optional" /></div>
                            <div className="grid gap-2"><Label>Coord Y <HelpTip text="GPS latitude or campus Y coordinate — paired with Coord X for distance calculations" /></Label><Input type="number" step="any" value={coordY} onChange={e => setCoordY(e.target.value)} placeholder="Optional" /></div>
                        </div>
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
            <DialogContent className="sm:max-w-[400px]">
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

export default function RoomsPage() {
    const [buildings, setBuildings] = useState<BuildingData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
    const [editBuilding, setEditBuilding] = useState<BuildingData | null>(null);
    const [roomDialogOpen, setRoomDialogOpen] = useState(false);
    const [editRoom, setEditRoom] = useState<Room | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ type: "building" | "room"; id: string; name: string } | null>(null);

    // Unavailability
    const [showUnavail, setShowUnavail] = useState<Room | null>(null);
    const [periods, setPeriods] = useState<any[]>([]);
    const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
    const [savingUnavail, setSavingUnavail] = useState(false);

    // Features
    const [showFeatures, setShowFeatures] = useState<Room | null>(null);
    const [features, setFeatures] = useState<any[]>([]);
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
    const [savingFeatures, setSavingFeatures] = useState(false);

    const fetchData = async (currentPage = page) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/buildings?page=${currentPage}&limit=50`);
            const data = await res.json();
            setBuildings(data.buildings || []);
            setTotalPages(Math.ceil((data.total || 0) / 50) || 1);
        } catch { toast.error("Failed to load buildings"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(page); }, [page]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const url = deleteTarget.type === "building" ? `/api/buildings/${deleteTarget.id}` : `/api/rooms/${deleteTarget.id}`;
            const res = await fetch(url, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            toast.success(`${deleteTarget.type === "building" ? "Building" : "Room"} deleted`);
            setDeleteTarget(null); fetchData();
        } catch (err: any) { toast.error(err.message); }
    };

    const openUnavail = async (r: Room) => {
        setShowUnavail(r);
        const [perRes, unRes] = await Promise.all([
            fetch("/api/periods?limit=200").then(res => res.json()),
            fetch(`/api/rooms/${r.id}/unavailability`).then(res => res.json())
        ]);
        setPeriods(perRes.periods || []);
        setSelectedPeriods((unRes.unavailability || []).map((u: any) => u.periodId));
    };

    const handleSaveUnavail = async () => {
        if (!showUnavail) return;
        setSavingUnavail(true);
        try {
            const res = await fetch(`/api/rooms/${showUnavail.id}/unavailability`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ periodIds: selectedPeriods })
            });
            if (!res.ok) throw new Error("Failed to save room blackout periods");
            toast.success("Room blackout periods saved");
            setShowUnavail(null);
        } catch (e: any) { toast.error(e.message); }
        setSavingUnavail(false);
    };

    const openFeatures = async (r: Room) => {
        setShowFeatures(r);
        const [featRes, assignRes] = await Promise.all([
            fetch("/api/features?limit=100").then(res => res.json()),
            fetch(`/api/rooms/${r.id}/features`).then(res => res.json())
        ]);
        setFeatures(featRes.features || []);
        setSelectedFeatures((assignRes.assignments || []).map((a: any) => a.featureId));
    };

    const handleSaveFeatures = async () => {
        if (!showFeatures) return;
        setSavingFeatures(true);
        try {
            const res = await fetch(`/api/rooms/${showFeatures.id}/features`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ featureIds: selectedFeatures })
            });
            if (!res.ok) throw new Error("Failed to save room features");
            toast.success("Room features saved");
            setShowFeatures(null);
        } catch (e: any) { toast.error(e.message); }
        setSavingFeatures(false);
    };

    const filtered = buildings.filter(b =>
        search === "" || b.name.toLowerCase().includes(search.toLowerCase()) || b.code.toLowerCase().includes(search.toLowerCase()) ||
        b.rooms.some(r => r.name.toLowerCase().includes(search.toLowerCase()))
    );

    const totalRooms = buildings.reduce((acc, b) => acc + b._count.rooms, 0);

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Rooms & Buildings</h2>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => { setEditBuilding(null); setBuildingDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Building</Button>
                    <Button onClick={() => { setEditRoom(null); setRoomDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Room</Button>
                </div>
            </div>

            <div className="flex items-center space-x-2 pb-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder="Search buildings or rooms..." className="pl-8 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="text-sm text-muted-foreground">{totalRooms} rooms in {buildings.length} buildings</div>
            </div>

            <div className="grid gap-6">
                {loading ? (
                    <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg">
                        <Building2 className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                        <h3 className="font-semibold text-lg text-foreground">No buildings configured</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mt-1">Add buildings and rooms to start placing exams.</p>
                    </div>
                ) : (
                    filtered.map(building => (
                        <Card key={building.id} className="overflow-hidden">
                            <CardHeader className="bg-muted/10 border-b py-4 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Building2 className="h-5 w-5 text-muted-foreground" />
                                        {building.name} <span className="text-muted-foreground font-normal">({building.code})</span>
                                    </CardTitle>
                                    <CardDescription>{building._count.rooms} {building._count.rooms === 1 ? 'room' : 'rooms'}</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => { setEditBuilding(building); setBuildingDialogOpen(true); }}>Edit</Button>
                                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteTarget({ type: "building", id: building.id, name: building.name })}>Delete</Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {building.rooms.length === 0 ? (
                                    <div className="p-8 text-center text-sm text-muted-foreground">No rooms added yet.</div>
                                ) : (
                                    <Table>
                                        <TableHeader className="bg-muted/5">
                                            <TableRow>
                                                <TableHead className="pl-6 w-[30%]">Room Name</TableHead>
                                                <TableHead>Normal Capacity</TableHead>
                                                <TableHead>Alternate Capacity</TableHead>
                                                <TableHead>Coordinates (X,Y)</TableHead>
                                                <TableHead className="w-[80px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {building.rooms.map(room => (
                                                <TableRow key={room.id}>
                                                    <TableCell className="pl-6 font-medium">{room.name}</TableCell>
                                                    <TableCell className="font-medium text-primary">{room.capacity}</TableCell>
                                                    <TableCell className="text-muted-foreground">{room.altCapacity || "—"}</TableCell>
                                                    <TableCell className="text-muted-foreground">{room.coordX != null && room.coordY != null ? `${room.coordX}, ${room.coordY}` : "—"}</TableCell>
                                                    <TableCell>
                                                        <div className="flex justify-end gap-1">
                                                            <Tip content="Manage features"><Button variant="ghost" size="sm" onClick={() => openFeatures(room)}>
                                                                <Tags className="h-4 w-4" />
                                                            </Button></Tip>
                                                            <Tip content="Manage blackout periods"><Button variant="ghost" size="sm" onClick={() => openUnavail(room)}>
                                                                <CalendarOff className="h-4 w-4" />
                                                            </Button></Tip>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => { setEditRoom(room); setRoomDialogOpen(true); }}>Edit room</DropdownMenuItem>
                                                                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ type: "room", id: room.id, name: room.name })}>Delete room</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
                <DataPagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>

            <BuildingDialog building={editBuilding} open={buildingDialogOpen} onOpenChange={setBuildingDialogOpen} onSaved={() => fetchData(page)} />
            <RoomDialog room={editRoom} buildings={buildings} open={roomDialogOpen} onOpenChange={setRoomDialogOpen} onSaved={() => fetchData(page)} />
            <DeleteDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }} onConfirm={handleDelete} title={deleteTarget?.name || ""} />

            {/* Room Unavailability Dialog */}
            <Dialog open={!!showUnavail} onOpenChange={() => setShowUnavail(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Blackout Periods — {showUnavail?.name}</DialogTitle>
                        <DialogDescription>Select periods when this room is completely unavailable (e.g. booked for another event, under maintenance).</DialogDescription>
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
                        <Button onClick={handleSaveUnavail} disabled={savingUnavail}>{savingUnavail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Room Features Dialog */}
            <Dialog open={!!showFeatures} onOpenChange={() => setShowFeatures(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Features — {showFeatures?.name}</DialogTitle>
                        <DialogDescription>Select the properties and equipment available in this room.</DialogDescription>
                    </DialogHeader>
                    <div className="border rounded-md max-h-64 overflow-y-auto p-2 bg-muted/5 space-y-1 my-4">
                        {features.map(feat => (
                            <div key={feat.id} className="flex items-center space-x-2 p-1.5 hover:bg-muted/50 rounded">
                                <Switch
                                    checked={selectedFeatures.includes(feat.id)}
                                    onCheckedChange={(checked) => {
                                        if (checked) setSelectedFeatures([...selectedFeatures, feat.id]);
                                        else setSelectedFeatures(selectedFeatures.filter(id => id !== feat.id));
                                    }}
                                />
                                <Label className="text-sm font-normal cursor-pointer select-none">
                                    <span className="font-semibold text-foreground">{feat.name}</span>
                                    <span className="text-muted-foreground ml-2 text-xs">({feat.code})</span>
                                </Label>
                            </div>
                        ))}
                        {features.length === 0 && <div className="text-sm text-muted-foreground p-2 text-center">No features exist in the system. <br /> Create features in the Room Features menu first.</div>}
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
