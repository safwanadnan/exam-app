import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { Plus, Clock, Search, MoreHorizontal, Settings2 } from "lucide-react";
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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default async function PeriodsPage() {
    const periods = await prisma.examPeriod.findMany({
        orderBy: [
            { date: "asc" },
            { startTime: "asc" }
        ],
        include: {
            examType: { select: { name: true, session: { select: { name: true } } } },
            _count: { select: { examAssignments: true } }
        },
        take: 100 // pagination placeholder
    });

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Exam Periods</h2>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Period
                </Button>
            </div>

            <div className="flex items-center space-x-2 pb-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search periods..."
                        className="pl-8 bg-background"
                    />
                </div>
                <Button variant="outline" size="icon">
                    <Settings2 className="h-4 w-4" />
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Time Slots Overview</CardTitle>
                    <CardDescription>
                        Manage available time periods and their penalty weights for the solver.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {periods.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg">
                            <Clock className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="font-semibold text-lg text-foreground">No periods configured</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">
                                Configure exam periods to define when exams can be scheduled.
                            </p>
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
                                        <TableHead className="text-right">Penalty Weight</TableHead>
                                        <TableHead className="text-right">Assignments</TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {periods.map((period: any) => (
                                        <TableRow key={period.id}>
                                            <TableCell className="font-medium">
                                                {format(new Date(period.date), "EEE, MMM d, yyyy")}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                    <span>{period.startTime} - {period.endTime}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {period.length} min
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm">{period.examType.name}</span>
                                                    <span className="text-xs text-muted-foreground">{period.examType.session.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {period.penalty === 0 ? (
                                                    <span className="text-muted-foreground">—</span>
                                                ) : (
                                                    <span className={period.penalty > 0 ? "text-destructive font-medium" : "text-emerald-600 font-medium"}>
                                                        {period.penalty > 0 ? "+" : ""}{period.penalty}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                                                    {period._count.examAssignments}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                                            <span className="sr-only">Toggle menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem>Edit period</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive">Delete period</DropdownMenuItem>
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
        </div>
    );
}
