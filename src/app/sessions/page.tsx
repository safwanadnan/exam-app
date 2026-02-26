import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { Plus, MoreHorizontal, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default async function SessionsPage() {
    const sessions = await prisma.academicSession.findMany({
        orderBy: { year: "desc" },
        include: {
            _count: {
                select: { departments: true, solverRuns: true, examTypes: true },
            },
        },
    });

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Academic Sessions</h2>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Session
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Configured Terms</CardTitle>
                    <CardDescription>
                        Manage academic sessions (terms/semesters) for exam scheduling.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg">
                            <Calendar className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="font-semibold text-lg text-foreground">No sessions yet</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">
                                You haven't configured any academic sessions yet. Create a session to get started with scheduling.
                            </p>
                            <Button className="mt-6" variant="outline">
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
                                    <TableHead className="text-right">Exam Types</TableHead>

                                    <TableHead className="text-right">Solver Runs</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sessions.map((session: any) => (
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
                                                        <span className="sr-only">Toggle menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem>View details</DropdownMenuItem>
                                                    <DropdownMenuItem>Edit session</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
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
        </div>
    );
}
