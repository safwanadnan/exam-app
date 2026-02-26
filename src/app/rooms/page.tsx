import { prisma } from "@/lib/prisma";
import { Plus, Building2, Search, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default async function RoomsPage() {
    const buildings = await prisma.building.findMany({
        orderBy: { name: "asc" },
        include: {
            rooms: {
                orderBy: { name: "asc" }
            },
            _count: {
                select: { rooms: true }
            }
        }
    });

    const totalRooms = buildings.reduce((acc: number, b: any) => acc + b._count.rooms, 0);

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Rooms & Buildings</h2>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Plus className="mr-2 h-4 w-4" /> Add Building
                    </Button>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Room
                    </Button>
                </div>
            </div>

            <div className="flex items-center space-x-2 pb-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search buildings or rooms..."
                        className="pl-8 bg-background"
                    />
                </div>
            </div>

            <div className="grid gap-6">
                {buildings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg">
                        <Building2 className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                        <h3 className="font-semibold text-lg text-foreground">No buildings configured</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mt-1">
                            Add buildings and rooms to start placing exams.
                        </p>
                    </div>
                ) : (
                    buildings.map((building: any) => (
                        <Card key={building.id} className="overflow-hidden">
                            <CardHeader className="bg-muted/10 border-b py-4 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Building2 className="h-5 w-5 text-muted-foreground" />
                                        {building.name} <span className="text-muted-foreground font-normal">({building.code})</span>
                                    </CardTitle>
                                    <CardDescription>
                                        {building._count.rooms} {building._count.rooms === 1 ? 'room' : 'rooms'}
                                    </CardDescription>
                                </div>
                                <Button variant="outline" size="sm">Edit Building</Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                {building.rooms.length === 0 ? (
                                    <div className="p-8 text-center text-sm text-muted-foreground">
                                        No rooms added to this building yet.
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader className="bg-muted/5">
                                            <TableRow>
                                                <TableHead className="pl-6 w-[30%]">Room Name</TableHead>
                                                <TableHead>Normal Capacity</TableHead>
                                                <TableHead>Alternate Seating Capacity</TableHead>
                                                <TableHead>Coordinates (X,Y)</TableHead>
                                                <TableHead className="w-[80px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {building.rooms.map((room: any) => (
                                                <TableRow key={room.id}>
                                                    <TableCell className="pl-6 font-medium">{room.name}</TableCell>
                                                    <TableCell className="font-medium text-primary">
                                                        {room.capacity}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {room.altCapacity || "—"}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {room.coordX !== null && room.coordY !== null
                                                            ? `${room.coordX}, ${room.coordY}`
                                                            : "—"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                    <span className="sr-only">Toggle menu</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem>Edit room</DropdownMenuItem>
                                                                <DropdownMenuItem className="text-destructive">Delete room</DropdownMenuItem>
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
                    ))
                )}
            </div>
        </div>
    );
}
