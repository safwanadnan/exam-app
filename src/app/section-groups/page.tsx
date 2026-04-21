"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
    Layers, Users, BookOpen, ToggleLeft, ToggleRight, RefreshCw,
    ChevronDown, ChevronRight, ShieldAlert, ShieldCheck, Wand2, Loader2, GraduationCap, Hash
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SectionMember {
    id: string;
    section: {
        sectionNumber: string;
        _count: { enrollments: number };
    };
}

interface SectionGroup {
    id: string;
    instructorKey: string;
    instructorNames: string[];
    sameDayRequired: boolean;
    course: {
        courseNumber: string;
        title: string;
        subject: { code: string };
    };
    members: SectionMember[];
    _count: { members: number };
}

// Groups the flat list into: courseTitle → SectionGroup[]
interface CourseNode {
    courseTitle: string;
    totalStudents: number;
    totalClasses: number;   // total class codes across ALL teacher sections
    groups: SectionGroup[]; // one entry per teacher = one "section"
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SectionGroupsPage() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState("");
    const [groups, setGroups] = useState<SectionGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [recomputing, setRecomputing] = useState(false);
    const [recomputeResult, setRecomputeResult] = useState<any>(null);
    const [toggling, setToggling] = useState<Set<string>>(new Set());
    // expanded state for course rows and section rows
    const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    // ── Sessions ──────────────────────────────────────────────────────────────
    useEffect(() => {
        fetch("/api/sessions").then(r => r.json()).then(data => {
            setSessions(data.sessions || []);
            const active = data.sessions?.find((s: any) => s.isActive);
            if (active) setSelectedSessionId(active.id);
            else if (data.sessions?.length) setSelectedSessionId(data.sessions[0].id);
        });
    }, []);

    // ── Fetch groups ──────────────────────────────────────────────────────────
    const fetchGroups = useCallback(async () => {
        if (!selectedSessionId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/section-groups?sessionId=${selectedSessionId}`);
            const data = await res.json();
            setGroups(data.groups || []);
        } catch {
            toast.error("Failed to load section groups");
        } finally {
            setLoading(false);
        }
    }, [selectedSessionId]);

    useEffect(() => { fetchGroups(); }, [fetchGroups]);

    // ── Recompute ─────────────────────────────────────────────────────────────
    const handleRecompute = async () => {
        if (!selectedSessionId) return;
        setRecomputing(true);
        setRecomputeResult(null);
        try {
            const res = await fetch(`/api/section-groups/recompute?sessionId=${selectedSessionId}`, {
                method: "POST",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Recompute failed");
            setRecomputeResult(data);
            toast.success(data.message);
            await fetchGroups();
        } catch (e: any) {
            toast.error(e.message || "Failed to recompute section groups");
        } finally {
            setRecomputing(false);
        }
    };

    // ── Toggle same-day ───────────────────────────────────────────────────────
    const handleToggle = async (groupId: string, newValue: boolean) => {
        setToggling(prev => new Set(prev).add(groupId));
        try {
            const res = await fetch(`/api/section-groups/${groupId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sameDayRequired: newValue }),
            });
            if (!res.ok) throw new Error("Toggle failed");
            setGroups(prev => prev.map(g => g.id === groupId ? { ...g, sameDayRequired: newValue } : g));
            toast.success(
                newValue
                    ? "Same-day required — hard constraint added"
                    : "Constraint removed — sections can be on different days"
            );
        } catch (e: any) {
            toast.error(e.message || "Failed to update group");
        } finally {
            setToggling(prev => { const s = new Set(prev); s.delete(groupId); return s; });
        }
    };

    // ── Hierarchical grouping by course title ─────────────────────────────────
    const courseNodes = useMemo<CourseNode[]>(() => {
        const map = new Map<string, CourseNode>();
        for (const g of groups) {
            const key = g.course.title.trim().toLowerCase();
            if (!map.has(key)) {
                map.set(key, { courseTitle: g.course.title, totalStudents: 0, totalClasses: 0, groups: [] });
            }
            const node = map.get(key)!;
            node.groups.push(g);
            node.totalStudents += g.members.reduce((sum, m) => sum + m.section._count.enrollments, 0);
            node.totalClasses += g.members.length; // each member = one class code
        }
        return Array.from(map.values()).sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));
    }, [groups]);

    const toggleCourse = (key: string) => {
        setExpandedCourses(prev => {
            const s = new Set(prev);
            s.has(key) ? s.delete(key) : s.add(key);
            return s;
        });
    };

    const toggleSection = (id: string) => {
        setExpandedSections(prev => {
            const s = new Set(prev);
            s.has(id) ? s.delete(id) : s.add(id);
            return s;
        });
    };

    // ── Stats ─────────────────────────────────────────────────────────────────
    const sameDayCount = groups.filter(g => g.sameDayRequired).length;
    const flexCount = groups.filter(g => !g.sameDayRequired).length;

    return (
        <div className="flex-1 space-y-6">

            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Layers className="h-7 w-7 text-primary" />
                        Section Groups
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Course → Teacher Section (toggle) → Class Codes.
                        Same course + same teacher = one section. Toggle ON = SAME_DAY hard constraint.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select session" />
                        </SelectTrigger>
                        <SelectContent>
                            {sessions.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name} ({s.term} {s.year})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        onClick={handleRecompute}
                        disabled={recomputing || !selectedSessionId}
                        className="gap-2"
                    >
                        {recomputing
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Recomputing…</>
                            : <><Wand2 className="h-4 w-4" /> Recompute Groups</>
                        }
                    </Button>
                    <Button variant="outline" size="icon" onClick={fetchGroups} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </div>

            {/* ── Stats row ── */}
            {courseNodes.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <Card className="border-primary/20 bg-primary/5">
                        <CardContent className="pt-4 pb-4">
                            <div className="text-2xl font-bold text-primary">{courseNodes.length}</div>
                            <div className="text-sm text-muted-foreground">Unique Courses</div>
                        </CardContent>
                    </Card>
                    <Card className="border-emerald-500/20 bg-emerald-500/5">
                        <CardContent className="pt-4 pb-4">
                            <div className="text-2xl font-bold text-emerald-600">{sameDayCount}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <ToggleRight className="h-3 w-3" /> Same-day constrained
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-amber-500/20 bg-amber-500/5">
                        <CardContent className="pt-4 pb-4">
                            <div className="text-2xl font-bold text-amber-600">{flexCount}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <ToggleLeft className="h-3 w-3" /> Flexible scheduling
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── Diagnostic panel ── */}
            {recomputeResult && (
                <Card className="border-violet-500/20 bg-violet-500/5">
                    <CardHeader className="py-3 border-b">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Wand2 className="h-4 w-4 text-violet-600" />
                            Recompute Result
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3 pb-3 space-y-3">
                        <div className="flex flex-wrap gap-4 text-sm">
                            <span>📋 <strong>{recomputeResult.diagnostic?.totalExams ?? 0}</strong> exams</span>
                            <span>🔗 <strong>{recomputeResult.diagnostic?.examsWithOwners ?? 0}</strong> linked to a course</span>
                            <span>👤 <strong>{recomputeResult.diagnostic?.examsWithInstructors ?? 0}</strong> with instructors</span>
                            <span>📦 <strong>{recomputeResult.groupsCreated ?? 0}</strong> section groups created</span>
                            <span>⛓️ <strong>{recomputeResult.constraintsCreated ?? 0}</strong> SAME_DAY constraints</span>
                        </div>
                        {recomputeResult.diagnostic?.examsWithOwners === 0 && (
                            <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded px-3 py-2">
                                ⚠️ No exams are linked to a course. Ensure import data includes <code>courseCode</code>.
                            </p>
                        )}
                        {recomputeResult.diagnostic?.breakdown?.length > 0 && (
                            <div className="max-h-48 overflow-auto rounded border bg-background">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/50 sticky top-0">
                                        <tr>
                                            <th className="text-left px-3 py-1.5">Course Title</th>
                                            <th className="text-left px-3 py-1.5">Instructor</th>
                                            <th className="text-right px-3 py-1.5">Exams</th>
                                            <th className="text-right px-3 py-1.5">SAME_DAY?</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {recomputeResult.diagnostic.breakdown.map((row: any, i: number) => (
                                            <tr key={i} className={row.examCount >= 2 ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}>
                                                <td className="px-3 py-1 font-medium max-w-[200px] truncate">{row.courseTitle}</td>
                                                <td className="px-3 py-1 text-muted-foreground max-w-[200px] truncate">
                                                    {row.instructorKey === "__no_instructor__" ? <em>None</em> : row.instructorKey}
                                                </td>
                                                <td className="px-3 py-1 text-right">{row.examCount}</td>
                                                <td className="px-3 py-1 text-right">
                                                    {row.examCount >= 2
                                                        ? <span className="text-emerald-600 font-medium">✓</span>
                                                        : <span className="text-muted-foreground">—</span>
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ── Main hierarchical list ── */}
            <Card>
                <CardHeader className="border-b bg-muted/20 py-4">
                    <CardTitle className="text-lg">Courses & Sections</CardTitle>
                    <CardDescription>
                        Click a course to see teachers. Classes of the same teacher always share the same exam period. 
                        Enable "Sync" to force multiple teachers to have their exams at the same time.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-10 text-center">
                            <RefreshCw className="h-8 w-8 mx-auto animate-spin text-primary mb-2" />
                            <p className="text-muted-foreground text-sm">Loading…</p>
                        </div>
                    ) : courseNodes.length === 0 ? (
                        <div className="p-10 text-center text-muted-foreground">
                            <Layers className="h-10 w-10 mx-auto opacity-30 mb-3" />
                            <p className="font-medium">No section groups found</p>
                            <p className="text-sm mt-1">
                                Click <strong>Recompute Groups</strong> to generate groups from your imported data.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {courseNodes.map(node => {
                                        const courseKey = node.courseTitle.trim().toLowerCase();
                                const isCourseExpanded = expandedCourses.has(courseKey);
                                // sections = distinct teachers, classes = total class codes
                                const totalTeachers = node.groups.length;
                                const totalClasses = node.totalClasses;
                                const nodeStudents = node.totalStudents;

                                return (
                                    <div key={courseKey}>
                                        {/* ── Level 1: Course row ── */}
                                        <div
                                            className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors select-none"
                                            onClick={() => toggleCourse(courseKey)}
                                        >
                                            <span className="text-muted-foreground flex-shrink-0">
                                                {isCourseExpanded
                                                    ? <ChevronDown className="h-4 w-4" />
                                                    : <ChevronRight className="h-4 w-4" />
                                                }
                                            </span>
                                            <GraduationCap className="h-4 w-4 text-primary flex-shrink-0" />
                                            <span className="font-semibold text-sm flex-1 truncate">
                                                {node.courseTitle}
                                            </span>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {/* sections = number of distinct teachers */}
                                                <Badge variant="outline" className="text-[10px] gap-1 py-0">
                                                    <Layers className="h-2.5 w-2.5" />
                                                    {totalTeachers} {totalTeachers === 1 ? "section" : "sections"}
                                                </Badge>
                                                {/* classes = total class codes across all teacher sections */}
                                                <Badge variant="outline" className="text-[10px] gap-1 py-0 border-violet-300 text-violet-600">
                                                    <Hash className="h-2.5 w-2.5" />
                                                    {totalClasses} {totalClasses === 1 ? "class" : "classes"}
                                                </Badge>
                                                <Badge variant="secondary" className="text-[10px] gap-1 py-0">
                                                    <Users className="h-2.5 w-2.5" />
                                                    {nodeStudents} students
                                                </Badge>
                                            </div>
                                        </div>

                                        {/* ── Level 2: Teacher/Section rows ── */}
                                        {isCourseExpanded && (
                                            <div className="border-t bg-muted/5">
                                                {node.groups.map((group, idx) => {
                                                    const isSectionExpanded = expandedSections.has(group.id);
                                                    const isToggling = toggling.has(group.id);
                                                    const groupStudents = group.members.reduce(
                                                        (sum, m) => sum + m.section._count.enrollments, 0
                                                    );
                                                    const instructorDisplay = group.instructorNames.join(", ");
                                                    const classCount = group.members.length;

                                                    return (
                                                        <div key={group.id} className={idx > 0 ? "border-t border-muted/50" : ""}>
                                                            {/* Section bar */}
                                                            <div className="flex items-center gap-3 pl-10 pr-4 py-3 hover:bg-muted/30 transition-colors">
                                                                {/* Expand classes */}
                                                                <span
                                                                    className="text-muted-foreground cursor-pointer flex-shrink-0"
                                                                    onClick={() => toggleSection(group.id)}
                                                                >
                                                                    {isSectionExpanded
                                                                        ? <ChevronDown className="h-3.5 w-3.5" />
                                                                        : <ChevronRight className="h-3.5 w-3.5" />
                                                                    }
                                                                </span>

                                                                {/* Section info */}
                                                                <div
                                                                    className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer"
                                                                    onClick={() => toggleSection(group.id)}
                                                                >
                                                                    <span className="text-sm font-medium truncate text-foreground/90">
                                                                        {instructorDisplay}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
                                                                        <Hash className="h-3 w-3" />{classCount} {classCount === 1 ? "class" : "classes"}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
                                                                        <Users className="h-3 w-3" />{groupStudents}
                                                                    </span>
                                                                </div>

                                                                {/* Same-day toggle */}
                                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                                    {group.sameDayRequired && (
                                                                        <ShieldAlert className="h-3.5 w-3.5 text-emerald-600" />
                                                                    )}
                                                                    <Label
                                                                        htmlFor={`toggle-${group.id}`}
                                                                        className={`text-xs cursor-pointer select-none ${group.sameDayRequired ? "text-indigo-600 font-medium" : "text-muted-foreground"}`}
                                                                    >
                                                                        {group.sameDayRequired ? "Sync Course" : "Independent"}
                                                                    </Label>
                                                                    <Switch
                                                                        id={`toggle-${group.id}`}
                                                                        checked={group.sameDayRequired}
                                                                        disabled={isToggling}
                                                                        onCheckedChange={val => handleToggle(group.id, val)}
                                                                        className={`cursor-pointer ${group.sameDayRequired ? "data-[state=checked]:bg-indigo-600" : ""}`}
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* ── Level 3: Individual class codes ── */}
                                                            {isSectionExpanded && (
                                                                <div className="pl-16 pr-4 pb-3 pt-1 bg-muted/10 border-t border-muted/30">
                                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                                        {group.members.map(member => (
                                                                            <div
                                                                                key={member.id}
                                                                                className="flex items-center gap-1.5 text-xs bg-background border px-2.5 py-1.5 rounded-md shadow-sm"
                                                                            >
                                                                                <Hash className="h-3 w-3 text-muted-foreground" />
                                                                                <span className="font-medium">Class {member.section.sectionNumber}</span>
                                                                                <span className="text-muted-foreground">
                                                                                    · {member.section._count.enrollments} students
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    {group.members.length > 1 && (
                                                                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded px-2 py-1 w-fit">
                                                                            <ShieldCheck className="h-3 w-3" />
                                                                            Mandatory: These {group.members.length} classes always share the same period.
                                                                        </div>
                                                                    )}
                                                                    {group.sameDayRequired && (
                                                                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded px-2 py-1 w-fit">
                                                                            <Layers className="h-3 w-3" />
                                                                            Synced: Exam will happen at the same time as other "Synced" teachers of this course.
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
