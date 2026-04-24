"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
    Layers, Users, ToggleLeft, ToggleRight, RefreshCw,
    ChevronDown, ChevronRight, ShieldAlert, ShieldCheck, Wand2, Loader2, GraduationCap, Hash, Search
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HelpTip, Tip } from "@/components/tip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DataPagination } from "@/components/data-pagination";

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
    sameInstructorSyncRequired: boolean;
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
    const [clearing, setClearing] = useState(false);
    const [recomputeResult, setRecomputeResult] = useState<any>(null);
    const [toggling, setToggling] = useState<Set<string>>(new Set());
    // expanded state for course rows and section rows
    const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

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
    const fetchGroups = useCallback(async (currentPage = page) => {
        if (!selectedSessionId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                sessionId: selectedSessionId,
                page: currentPage.toString(),
                limit: "50",
                search: debouncedSearch
            });
            const res = await fetch(`/api/section-groups?${params.toString()}`);
            const data = await res.json();
            setGroups(data.groups || []);
            setTotalPages(Math.ceil((data.total || 0) / 50) || 1);
        } catch {
            toast.error("Failed to load section groups");
        } finally {
            setLoading(false);
        }
    }, [selectedSessionId, debouncedSearch]);

    useEffect(() => {
        setPage(1);
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => { fetchGroups(page); }, [page, fetchGroups]);

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

    const handleClearAll = async () => {
        if (!selectedSessionId || !confirm("Are you sure you want to turn off ALL synchronization rules (including same-instructor groups) for this entire session? This will make every section scheduled independently.")) return;
        setClearing(true);
        try {
            const res = await fetch("/api/section-groups/clear-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: selectedSessionId }),
            });
            if (!res.ok) throw new Error("Clear all failed");
            toast.success("All synchronization rules disabled");
            await fetchGroups();
        } catch (e: any) {
            toast.error(e.message || "Failed to clear sync rules");
        } finally {
            setClearing(false);
        }
    };

    const patchGroup = async (
        groupId: string,
        payload: { sameDayRequired?: boolean; sameInstructorSyncRequired?: boolean },
        successMessage: string
    ) => {
        setToggling(prev => new Set(prev).add(groupId));
        try {
            const res = await fetch(`/api/section-groups/${groupId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error("Toggle failed");
            setGroups(prev => prev.map(g => g.id === groupId ? {
                ...g,
                sameDayRequired: data.sameDayRequired,
                sameInstructorSyncRequired: data.sameInstructorSyncRequired,
            } : g));
            toast.success(successMessage);
        } catch (e: any) {
            toast.error(e.message || "Failed to update group");
        } finally {
            setToggling(prev => { const s = new Set(prev); s.delete(groupId); return s; });
        }
    };

    // ── Toggle cross-instructor sync ────────────────────────────────────────
    const handleCourseSyncToggle = async (groupId: string, newValue: boolean) => {
        await patchGroup(
            groupId,
            { sameDayRequired: newValue },
            newValue
                ? "Section synced"
                : "Section independent"
        );
    };

    const handleBulkToggle = async (node: CourseNode, newValue: boolean) => {
        const ids = node.groups.map(g => g.id);
        setToggling(prev => {
            const next = new Set(prev);
            ids.forEach(id => next.add(id));
            return next;
        });
        try {
            const res = await fetch("/api/section-groups", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids, sameDayRequired: newValue }),
            });
            if (!res.ok) throw new Error("Bulk update failed");
            setGroups(prev => prev.map(g => ids.includes(g.id) ? { ...g, sameDayRequired: newValue } : g));
            toast.success(newValue ? "All sections synced" : "All sections independent");
        } catch (e: any) {
            toast.error(e.message || "Failed to update sections");
        } finally {
            setToggling(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
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
        <div className="flex-1 space-y-6 pb-20">

            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-indigo-950 dark:text-indigo-100">
                        <Layers className="h-7 w-7 text-indigo-600" />
                        Section Management
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Group sections to ensure they share the same exam period.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                        <SelectTrigger className="w-50 h-10">
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
                        className="gap-2 h-10 bg-indigo-600 hover:bg-indigo-700"
                    >
                        {recomputing
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Recomputing…</>
                            : <><Wand2 className="h-4 w-4" /> Reset to Defaults</>
                        }
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleClearAll}
                        disabled={clearing || loading || !selectedSessionId}
                        className="gap-2 h-10 text-destructive hover:bg-destructive/10 border-destructive/30"
                    >
                        {clearing
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Clearing…</>
                            : <><ToggleLeft className="h-4 w-4" /> Turn Off All Sync</>
                        }
                    </Button>
                    <Button variant="outline" size="icon" onClick={fetchGroups} disabled={loading} className="h-10 w-10">
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </div>

            <div className="flex items-center space-x-2 pb-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        type="search" 
                        placeholder="Search groups by course or instructor..." 
                        className="pl-8 bg-background" 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                    />
                </div>
            </div>

            {/* ── Stats row ── */}
            {courseNodes.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-indigo-500/20 bg-indigo-500/5 shadow-sm">
                        <CardContent className="pt-4 pb-4">
                            <div className="text-2xl font-bold text-indigo-700">{courseNodes.length}</div>
                            <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Unique Courses</div>
                        </CardContent>
                    </Card>
                    <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-sm">
                        <CardContent className="pt-4 pb-4">
                            <div className="text-2xl font-bold text-emerald-600">{sameDayCount}</div>
                            <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3" /> Synced Sections
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-amber-500/20 bg-amber-500/5 shadow-sm">
                        <CardContent className="pt-4 pb-4">
                            <div className="text-2xl font-bold text-amber-600">{flexCount}</div>
                            <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                                <ToggleLeft className="h-3 w-3" /> Independent Sections
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── Main list ── */}
            <Card className="shadow-lg border-muted/60">
                <CardHeader className="border-b bg-muted/20 py-5">
                    <CardTitle className="text-xl flex items-center gap-2">
                        Course Groups
                    </CardTitle>
                    <CardDescription className="text-sm">
                        Sections of the same course are grouped together by default. Use the toggle on each course to separate different instructors into independent exam periods.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-20 text-center">
                            <Loader2 className="h-10 w-10 mx-auto animate-spin text-indigo-600 mb-4" />
                            <p className="text-muted-foreground font-medium">Loading courses and sections…</p>
                        </div>
                    ) : courseNodes.length === 0 ? (
                        <div className="p-20 text-center text-muted-foreground">
                            <Layers className="h-12 w-12 mx-auto opacity-20 mb-4" />
                            <p className="font-semibold text-lg text-foreground/70">No data found</p>
                            <p className="text-sm mt-2 max-w-xs mx-auto">
                                Click <strong>Reset to Defaults</strong> to analyze your imported data and create section groups.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-muted/60">
                            {courseNodes.map(node => {
                                const courseKey = node.courseTitle.trim().toLowerCase();
                                const isCourseExpanded = expandedCourses.has(courseKey);
                                const allSynced = node.groups.every(g => g.sameDayRequired);
                                const isSomeToggling = node.groups.some(g => toggling.has(g.id));

                                return (
                                    <div key={courseKey} className="group/course">
                                        {/* ── Course Row ── */}
                                        <div
                                            className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all select-none"
                                            onClick={() => toggleCourse(courseKey)}
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <span className="text-muted-foreground shrink-0 transition-transform group-hover/course:scale-110">
                                                    {isCourseExpanded
                                                        ? <ChevronDown className="h-5 w-5" />
                                                        : <ChevronRight className="h-5 w-5" />
                                                    }
                                                </span>
                                                <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                                                    <GraduationCap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-base truncate text-indigo-950 dark:text-indigo-100">
                                                        {node.courseTitle}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                                                            <Layers className="h-3 w-3" />
                                                            {node.groups.length} {node.groups.length === 1 ? "instructor set" : "instructor sets"}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                                                            <Users className="h-3 w-3" />
                                                            {node.totalStudents} students
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Course-level Toggle */}
                                            <div 
                                                className="flex items-center gap-3 px-4 py-2 bg-background border rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <Label 
                                                    htmlFor={`bulk-toggle-${courseKey}`}
                                                    className={cn(
                                                        "text-xs font-bold uppercase tracking-wider cursor-pointer",
                                                        allSynced ? "text-indigo-600" : "text-muted-foreground"
                                                    )}
                                                >
                                                    {allSynced ? "Grouped" : "Separate"}
                                                </Label>
                                                <Switch
                                                    id={`bulk-toggle-${courseKey}`}
                                                    checked={allSynced}
                                                    disabled={isSomeToggling}
                                                    onCheckedChange={val => handleBulkToggle(node, val)}
                                                    className="data-[state=checked]:bg-indigo-600"
                                                />
                                            </div>
                                        </div>

                                        {/* ── Section Rows ── */}
                                        {isCourseExpanded && (
                                            <div className="bg-muted/10 border-t border-muted/40 divide-y divide-muted/40">
                                                {node.groups.map((group) => {
                                                    const isToggling = toggling.has(group.id);
                                                    const groupStudents = group.members.reduce(
                                                        (sum, m) => sum + m.section._count.enrollments, 0
                                                    );
                                                    const instructorDisplay = group.instructorNames.join(", ");
                                                    const isExpanded = expandedSections.has(group.id);

                                                    return (
                                                        <div key={group.id} className="pl-14 pr-6 py-3.5 flex flex-col gap-3">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div 
                                                                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                                                    onClick={() => toggleSection(group.id)}
                                                                >
                                                                    <div className={cn(
                                                                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0 border",
                                                                        group.sameDayRequired ? "bg-indigo-100 border-indigo-200 text-indigo-700" : "bg-muted border-muted-foreground/20 text-muted-foreground"
                                                                    )}>
                                                                        <Users className="h-4 w-4" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="font-semibold text-sm truncate">
                                                                            {instructorDisplay}
                                                                        </div>
                                                                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight flex items-center gap-2 mt-0.5">
                                                                            <span>{group.members.length} {group.members.length === 1 ? "Class" : "Classes"}</span>
                                                                            <span>•</span>
                                                                            <span>{groupStudents} Students</span>
                                                                            {group.sameDayRequired && (
                                                                                <Badge variant="outline" className="h-4 text-[9px] border-indigo-200 bg-indigo-50 text-indigo-700 px-1 font-bold">
                                                                                    SYNCED
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Individual Toggle (Secondary) */}
                                                                <div className="flex items-center gap-4">
                                                                    {!group.sameInstructorSyncRequired && group.members.length > 1 && (
                                                                        <Tip content="Same-instructor sync is OFF for this section.">
                                                                            <Badge variant="outline" className="h-6 text-[10px] border-amber-200 bg-amber-50 text-amber-700 px-1.5 font-bold flex items-center gap-1">
                                                                                <ToggleLeft className="h-3 w-3" /> NO INST. SYNC
                                                                            </Badge>
                                                                        </Tip>
                                                                    )}
                                                                    <Switch
                                                                        checked={group.sameDayRequired}
                                                                        disabled={isToggling}
                                                                        onCheckedChange={val => handleCourseSyncToggle(group.id, val)}
                                                                        className="scale-90 data-[state=checked]:bg-indigo-600"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Class Breakdown */}
                                                            {isExpanded && (
                                                                <div className="flex flex-wrap gap-2 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                    {group.members.map(member => (
                                                                        <div
                                                                            key={member.id}
                                                                            className="flex items-center gap-1.5 text-[11px] bg-background border px-2 py-1 rounded shadow-sm"
                                                                        >
                                                                            <span className="font-bold text-indigo-600">#{member.section.sectionNumber}</span>
                                                                            <span className="text-muted-foreground">({member.section._count.enrollments} enroll)</span>
                                                                        </div>
                                                                    ))}
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
            <div className="mt-6">
                <DataPagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
        </div>
    );
}
