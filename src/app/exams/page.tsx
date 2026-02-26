import { prisma } from "@/lib/prisma";
import { Plus, GraduationCap, Search, MoreHorizontal, Settings2 } from "lucide-react";
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

export default async function ExamsPage() {
    const exams = await prisma.exam.findMany({
        orderBy: { name: "asc" },
        include: {
            examType: {
                select: { name: true, session: { select: { name: true } } }
            },
            owners: {
                include: {
                    section: {
                        include: { course: { include: { subject: true } } }
                    }
                }
            },
            _count: {
                select: { studentEnrollments: true, instructorAssignments: true }
            }
        },
        take: 100 // Limit for initial view
    });

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Exams & Courses</h2>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Exam
                </Button>
            </div>

            <div className="flex items-center space-x-2 pb-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search exams or courses..."
                        className="pl-8 bg-background"
                    />
                </div>
                <Button variant="outline" size="icon">
                    <Settings2 className="h-4 w-4" />
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Exam Configurations</CardTitle>
                    <CardDescription>
                        Manage exams, scheduling parameters, and seating requirements.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {exams.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg">
                            <GraduationCap className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="font-semibold text-lg text-foreground">No exams found</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">
                                Import data or create your first exam to begin scheduling.
                            </p>
                        </div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader className="bg-muted/5">
                                    <TableRow>
                                        <TableHead>Exam Name</TableHead>
                                        <TableHead>Course Owners</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Length (min)</TableHead>
                                        <TableHead className="text-right">Enrolled</TableHead>
                                        <TableHead className="text-right">Max Rooms</TableHead>
                                        <TableHead className="text-center">Alt Seating</TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {exams.map((exam: any) => (
                                        <TableRow key={exam.id}>
                                            <TableCell className="font-medium">{exam.name || "Unnamed Exam"}</TableCell>
                                            <TableCell className="text-sm">
                                                <div className="flex flex-wrap gap-1">
                                                    {exam.owners.length > 0 ? exam.owners.map((owner: any) => (
                                                        <span key={owner.id} className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                                                            {owner.section.course.subject.abbreviation} {owner.section.course.courseNumber} ({owner.section.name})
                                                        </span>
                                                    )) : (
                                                        <span className="text-muted-foreground italic text-xs">No owner</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span>{exam.examType.name}</span>
                                                    <span className="text-xs text-muted-foreground">{exam.examType.session.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{exam.length}</TableCell>
                                            <TableCell className="text-right">
                                                <span className="font-medium text-primary">{exam._count.studentEnrollments}</span>
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                {exam.maxRooms}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {exam.altSeating ? (
                                                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                                                        Required
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
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
                                                        <DropdownMenuItem>View details</DropdownMenuItem>
                                                        <DropdownMenuItem>Edit exam constraints</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive">Delete exam</DropdownMenuItem>
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
