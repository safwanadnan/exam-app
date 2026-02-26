import { prisma } from "@/lib/prisma";
import { Users, Search, MoreHorizontal } from "lucide-react";
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

export default async function StudentsPage() {
    const students = await prisma.student.findMany({
        orderBy: { name: "asc" },
        include: {
            _count: { select: { enrollments: true } },
        },
        take: 100 // pagination placeholder
    });

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Students & Instructors</h2>
                <div className="flex items-center gap-2">
                    <Button variant="outline">Import Roster</Button>
                </div>
            </div>

            <div className="flex items-center space-x-2 pb-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search by name or external ID..."
                        className="pl-8 bg-background"
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Student Registry</CardTitle>
                    <CardDescription>
                        View student enrollment data to resolve schedule conflicts.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {students.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg">
                            <Users className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="font-semibold text-lg text-foreground">No students found</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">
                                Student data is typically populated via the bulk import tool.
                            </p>
                        </div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader className="bg-muted/5">
                                    <TableRow>
                                        <TableHead className="w-[120px]">Student ID</TableHead>
                                        <TableHead>Full Name</TableHead>
                                        <TableHead className="text-right">Enrolled Exams</TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.map((student: any) => (
                                        <TableRow key={student.id}>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{student.externalId}</TableCell>
                                            <TableCell className="font-medium">{student.name}</TableCell>
                                            <TableCell className="text-right">
                                                <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                                                    {student._count.enrollments} exams
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Button size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                                </Button>
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
