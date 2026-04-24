"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
    Search, 
    User, 
    Printer, 
    RefreshCw, 
    Calendar, 
    MapPin, 
    Clock, 
    Building, 
    Info, 
    Loader2,
    CheckCircle2,
    AlertCircle,
    Dice5,
    GraduationCap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAcademicSession } from "@/components/academic-session-provider";
import { cn } from "@/lib/utils";

interface Student {
    id: string;
    externalId: string;
    name: string;
}

interface DetailedStudent extends Student {
    enrollments: {
        exam: {
            id: string;
            name: string;
            length: number;
            examType: { name: string };
            assignments: {
                period: { date: string; startTime: string; endTime: string };
                rooms: {
                    room: {
                        name: string;
                        building: { name: string };
                    };
                }[];
            }[];
        };
    }[];
}

function AdmitCardContent() {
    const { currentSessionId } = useAcademicSession();
    const searchParams = useSearchParams();
    const [search, setSearch] = useState("");
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [studentData, setStudentData] = useState<DetailedStudent | null>(null);
    const [dataLoading, setDataLoading] = useState(false);

    const loadStudentData = useCallback(async (id: string) => {
        setDataLoading(true);
        try {
            const params = new URLSearchParams();
            if (currentSessionId) params.set("sessionId", currentSessionId);
            const res = await fetch(`/api/students/${id}?${params}`);
            if (!res.ok) throw new Error("Failed to load");
            const data = await res.json();
            setStudentData(data);
            setSelectedStudentId(id);
            setSearch("");
            setStudents([]);
        } catch {
            toast.error("Failed to load student details");
        } finally {
            setDataLoading(false);
        }
    }, [currentSessionId]);

    useEffect(() => {
        const id = searchParams.get("id");
        if (id) {
            loadStudentData(id);
        }
    }, [searchParams, loadStudentData]);

    const fetchStudents = useCallback(async (q: string) => {
        if (q.length < 2) {
            setStudents([]);
            return;
        }
        setLoading(true);
        try {
            const params = new URLSearchParams({ search: q, limit: "10" });
            if (currentSessionId) params.set("sessionId", currentSessionId);
            const res = await fetch(`/api/students?${params}`);
            const data = await res.json();
            setStudents(data.students || []);
        } catch {
            toast.error("Failed to search students");
        } finally {
            setLoading(false);
        }
    }, [currentSessionId]);

    useEffect(() => {
        const t = setTimeout(() => fetchStudents(search), 300);
        return () => clearTimeout(t);
    }, [search, fetchStudents]);

    const pickRandom = async () => {
        setDataLoading(true);
        try {
            const res = await fetch("/api/students/random");
            const data = await res.json();
            if (data.id) {
                loadStudentData(data.id);
            }
        } catch {
            toast.error("Failed to pick a random student");
            setDataLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="flex-1 space-y-6 max-w-5xl mx-auto pb-10">
            {/* Header - Hidden on Print */}
            <div className="flex items-center justify-between print:hidden">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Admit Cards & Timetables</h2>
                    <p className="text-muted-foreground text-sm mt-1">Search or select a student to generate their official exam admit card.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={pickRandom} disabled={dataLoading}>
                        {dataLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Dice5 className="mr-2 h-4 w-4 text-purple-500" />}
                        Random Student
                    </Button>
                    {studentData && (
                        <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90">
                            <Printer className="mr-2 h-4 w-4" /> Print Admit Card
                        </Button>
                    )}
                </div>
            </div>

            {/* Selection Area - Hidden on Print */}
            <div className="relative print:hidden">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                    className="pl-10 h-12 text-lg bg-background border-2 focus-visible:ring-primary/20"
                    placeholder="Search student by name or ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {loading && (
                    <div className="absolute right-3 top-3">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                )}

                {/* Suggestions List */}
                {students.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-popover border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="py-2">
                            {students.map((s) => (
                                <button
                                    key={s.id}
                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted transition-colors text-left"
                                    onClick={() => loadStudentData(s.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                            {s.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-medium">{s.name}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{s.externalId}</div>
                                        </div>
                                    </div>
                                    <Badge variant="outline">Select</Badge>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Admit Card Content */}
            {!studentData && !dataLoading && (
                <Card className="border-dashed py-20 print:hidden">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-semibold">No Student Selected</h3>
                            <p className="text-muted-foreground max-w-sm">Use the search bar above or pick a random student to see their exam schedule.</p>
                        </div>
                    </div>
                </Card>
            )}

            {dataLoading && (
                <div className="flex flex-col items-center justify-center py-20 space-y-4 print:hidden">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse">Generating admit card...</p>
                </div>
            )}

            {studentData && !dataLoading && (
                <div className="space-y-8">
                    {/* The Admit Card Document */}
                    <Card className="relative overflow-hidden border-2 shadow-xl print:shadow-none print:border-black print:rounded-none">
                        {/* Decorative background for screen */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 print:hidden" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full -ml-16 -mb-16 print:hidden" />

                        <CardHeader className="border-b bg-muted/30 print:bg-transparent print:border-b-2 print:border-black flex flex-row items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 bg-primary rounded-xl flex items-center justify-center text-primary-foreground print:bg-black">
                                    <GraduationCap className="h-8 w-8" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl print:text-3xl">EXAMINATION ADMIT CARD</CardTitle>
                                    <CardDescription className="print:text-black">Official Student Timetable - Academic Session 2024/25</CardDescription>
                                </div>
                            </div>
                            <div className="text-right print:text-black">
                                <div className="text-sm font-semibold uppercase text-muted-foreground print:text-black">Issue Date</div>
                                <div className="font-mono">{format(new Date(), "dd-MMM-yyyy")}</div>
                            </div>
                        </CardHeader>

                        <CardContent className="p-8 space-y-8">
                            {/* Student Profile Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-muted/20 p-6 rounded-2xl border print:border-black print:rounded-none print:bg-transparent">
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-xs font-bold uppercase text-muted-foreground print:text-black">Full Name</div>
                                        <div className="text-2xl font-bold">{studentData.name}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold uppercase text-muted-foreground print:text-black">Student ID / Enrollment No.</div>
                                        <div className="text-xl font-mono">{studentData.externalId}</div>
                                    </div>
                                </div>
                                <div className="flex flex-col md:items-end justify-center space-y-2">
                                    <div className="text-sm px-3 py-1 bg-green-500/10 text-green-600 rounded-full border border-green-500/20 flex items-center gap-2 print:border-black print:text-black">
                                        <CheckCircle2 className="h-4 w-4" /> Validated Profile
                                    </div>
                                    <div className="text-xs text-muted-foreground print:text-black">Session: {currentSessionId || "Default"}</div>
                                </div>
                            </div>

                            {/* Timetable Table */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-lg font-bold flex items-center gap-2">
                                        <Calendar className="h-5 w-5 text-primary print:text-black" />
                                        Scheduled Examinations
                                    </h4>
                                    <Badge variant="secondary" className="print:hidden">
                                        {studentData.enrollments.length} Exam{studentData.enrollments.length !== 1 ? "s" : ""}
                                    </Badge>
                                </div>

                                <div className="rounded-xl border overflow-hidden print:border-black print:rounded-none">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-muted/50 print:bg-transparent print:border-b-2 print:border-black">
                                            <tr>
                                                <th className="px-4 py-3 text-sm font-bold uppercase text-muted-foreground print:text-black border-b">Exam Details</th>
                                                <th className="px-4 py-3 text-sm font-bold uppercase text-muted-foreground print:text-black border-b">Date & Time</th>
                                                <th className="px-4 py-3 text-sm font-bold uppercase text-muted-foreground print:text-black border-b">Location</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y print:divide-black">
                                            {studentData.enrollments.map((e) => {
                                                const assignment = e.exam.assignments?.[0];
                                                const period = assignment?.period;
                                                const rooms = assignment?.rooms || [];

                                                return (
                                                    <tr key={e.exam.id} className="hover:bg-muted/30 transition-colors">
                                                        <td className="px-4 py-4">
                                                            <div className="font-bold">{e.exam.name}</div>
                                                            <div className="text-xs text-muted-foreground print:text-black flex items-center gap-2 mt-1">
                                                                <Badge variant="outline" className="text-[10px] h-4 print:border-black">{e.exam.examType.name}</Badge>
                                                                <span>Duration: {e.exam.length}m</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            {period ? (
                                                                <div className="space-y-1">
                                                                    <div className="font-semibold flex items-center gap-1.5">
                                                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground print:text-black" />
                                                                        {format(new Date(period.date), "EEEE, MMM d, yyyy")}
                                                                    </div>
                                                                    <div className="text-sm flex items-center gap-1.5 text-muted-foreground print:text-black">
                                                                        <Clock className="h-3.5 w-3.5" />
                                                                        {period.startTime} – {period.endTime}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground italic text-sm flex items-center gap-1.5">
                                                                    <AlertCircle className="h-3.5 w-3.5" /> Not yet scheduled
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            {rooms.length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {rooms.map((r, i) => (
                                                                        <div key={i} className="flex items-start gap-1.5">
                                                                            <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 print:text-black" />
                                                                            <div>
                                                                                <div className="font-semibold">{r.room.name}</div>
                                                                                <div className="text-xs text-muted-foreground print:text-black">{r.room.building.name}</div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : assignment ? (
                                                                <span className="text-sm text-muted-foreground italic">Room TBD</span>
                                                            ) : (
                                                                <span className="text-sm text-muted-foreground italic">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {studentData.enrollments.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground italic">
                                                        No exams enrolled for this session.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Instructions / Footer */}
                            <div className="bg-orange-500/5 p-6 rounded-xl border border-orange-500/10 space-y-3 print:bg-transparent print:border-black print:rounded-none">
                                <h5 className="text-sm font-bold flex items-center gap-2 text-orange-700 print:text-black">
                                    <Info className="h-4 w-4" />
                                    Important Instructions
                                </h5>
                                <ul className="text-xs text-orange-800/80 space-y-1.5 list-disc pl-4 print:text-black">
                                    <li>Students must present this admit card and a valid University ID for entry to the exam hall.</li>
                                    <li>Please arrive at the examination center at least 30 minutes before the scheduled start time.</li>
                                    <li>No electronic devices (smartphones, watches, etc.) are allowed inside the examination hall.</li>
                                    <li>Ensure that all the details on this card are correct. Report discrepancies to the Registrar's office.</li>
                                </ul>
                            </div>

                            {/* Signatures */}
                            <div className="pt-12 grid grid-cols-2 gap-20">
                                <div className="border-t-2 border-dashed border-muted-foreground/30 pt-4 text-center print:border-black">
                                    <div className="text-xs font-bold uppercase text-muted-foreground print:text-black">Student's Signature</div>
                                </div>
                                <div className="border-t-2 border-dashed border-muted-foreground/30 pt-4 text-center print:border-black">
                                    <div className="text-xs font-bold uppercase text-muted-foreground print:text-black">Controller of Examinations</div>
                                </div>
                            </div>
                        </CardContent>

                        {/* Security Footer */}
                        <div className="bg-muted py-2 px-8 flex justify-between items-center text-[10px] text-muted-foreground font-mono print:bg-transparent print:text-black">
                            <span>UID: {studentData.id.substring(0, 12).toUpperCase()}</span>
                            <span>VERIFIED GENERATION • SECURE SYSTEM</span>
                            <span>{new Date().toISOString()}</span>
                        </div>
                    </Card>

                    {/* Quick Tips - Screen Only */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
                        <Card className="bg-blue-500/5 border-blue-500/10">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                                    <Printer className="h-4 w-4" /> Print Tips
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 text-xs text-blue-800/70">
                                Use "Save as PDF" for a digital copy. Set layout to "Portrait" for best results.
                            </CardContent>
                        </Card>
                        <Card className="bg-purple-500/5 border-purple-500/10">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
                                    < Dice5 className="h-4 w-4" /> Bulk Mode
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 text-xs text-purple-800/70">
                                Coming soon: Generate admit cards for an entire department or course at once.
                            </CardContent>
                        </Card>
                        <Card className="bg-green-500/5 border-green-500/10">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                                    <RefreshCw className="h-4 w-4" /> Real-time Updates
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 text-xs text-green-800/70">
                                Schedule changes reflect instantly on generated admit cards.
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body {
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    main {
                        padding: 0 !important;
                        margin: 0 !important;
                        background: white !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    header, footer, nav, .sidebar {
                        display: none !important;
                    }
                    .flex-1 {
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    /* Reset colors for printing */
                    .text-muted-foreground {
                        color: black !important;
                    }
                }
            `}</style>
        </div>
    );
}

export default function AdmitCardsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <AdmitCardContent />
        </Suspense>
    );
}
