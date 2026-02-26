import { prisma } from "@/lib/prisma";
import { Plus, Settings2, Search, MoreHorizontal } from "lucide-react";
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

export default async function ConstraintsPage() {
    const constraints = await prisma.distributionConstraint.findMany({
        orderBy: { type: "asc" },
        include: {
            examA: { select: { name: true, examType: { select: { session: { select: { name: true } } } } } },
            examB: { select: { name: true } },
        }
    });

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Distribution Constraints</h2>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Constraint
                </Button>
            </div>

            <div className="flex items-center space-x-2 pb-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search constraints..."
                        className="pl-8 bg-background"
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Global Rules</CardTitle>
                    <CardDescription>
                        Manage hard and soft distribution constraints between specific exams (e.g. Same Room, Max Day Break).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {constraints.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg">
                            <Settings2 className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="font-semibold text-lg text-foreground">No constraints found</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">
                                Distribution constraints map rules between two specific exams.
                            </p>
                        </div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader className="bg-muted/5">
                                    <TableRow>
                                        <TableHead className="w-[180px]">Constraint Type</TableHead>
                                        <TableHead>Primary Exam (A)</TableHead>
                                        <TableHead>Secondary Exam (B)</TableHead>
                                        <TableHead className="text-center w-[120px]">Enforcement</TableHead>
                                        <TableHead className="text-right w-[100px]">Weight</TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {constraints.map((c: any) => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-medium font-mono text-xs">
                                                {c.type}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span>{c.examA.name || "Unnamed Exam"}</span>
                                                    <span className="text-xs text-muted-foreground">{c.examA.examType.session.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {c.examB.name || "Unnamed Exam"}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {c.hard ? (
                                                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                                                        HARD
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                                                        SOFT
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                {c.hard ? "—" : c.weight}
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
