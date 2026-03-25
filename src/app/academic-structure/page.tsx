"use client";

import { useEffect, useState } from "react";
import { FolderTree, Plus, ChevronRight, ChevronDown, Layers, BookOpen, Hash, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { HelpTip } from "@/components/tip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DataPagination } from "@/components/data-pagination";

export default function AcademicStructurePage() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string>("");

    // Data states
    const [departments, setDepartments] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<Record<string, any[]>>({});
    const [courses, setCourses] = useState<Record<string, any[]>>({});
    const [sections, setSections] = useState<Record<string, any[]>>({});

    // Expansion states
    const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
    const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
    const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

    // Creation states
    const [createType, setCreateType] = useState<"dept" | "subj" | "course" | "section" | null>(null);
    const [createParentId, setCreateParentId] = useState<string>("");
    const [formData, setFormData] = useState({ code: "", name: "", title: "", length: 0 });
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        fetch("/api/sessions").then(r => r.json()).then(data => {
            setSessions(data.sessions || []);
            const active = data.sessions?.find((s: any) => s.isActive);
            if (active) setSelectedSessionId(active.id);
            else if (data.sessions?.length) setSelectedSessionId(data.sessions[0].id);
        });
    }, []);

    const fetchDepartments = async (currentPage = page) => {
        if (!selectedSessionId) return;
        try {
            const res = await fetch(`/api/departments?sessionId=${selectedSessionId}&page=${currentPage}&limit=50`);
            const data = await res.json();
            setDepartments(data.departments || []);
            setTotalPages(Math.ceil((data.total || 0) / 50) || 1);
        } catch { toast.error("Failed to load departments"); }
    };

    useEffect(() => { fetchDepartments(page); }, [selectedSessionId, page]);

    const toggleDept = async (deptId: string) => {
        const newSet = new Set(expandedDepts);
        if (newSet.has(deptId)) {
            newSet.delete(deptId);
        } else {
            newSet.add(deptId);
            if (!subjects[deptId]) {
                const res = await fetch(`/api/subjects?departmentId=${deptId}`);
                const data = await res.json();
                setSubjects(prev => ({ ...prev, [deptId]: data.subjects || [] }));
            }
        }
        setExpandedDepts(newSet);
    };

    const toggleSubject = async (subjId: string) => {
        const newSet = new Set(expandedSubjects);
        if (newSet.has(subjId)) {
            newSet.delete(subjId);
        } else {
            newSet.add(subjId);
            if (!courses[subjId]) {
                const res = await fetch(`/api/courses?subjectId=${subjId}`);
                const data = await res.json();
                setCourses(prev => ({ ...prev, [subjId]: data.courses || [] }));
            }
        }
        setExpandedSubjects(newSet);
    };

    const toggleCourse = async (courseId: string) => {
        const newSet = new Set(expandedCourses);
        if (newSet.has(courseId)) {
            newSet.delete(courseId);
        } else {
            newSet.add(courseId);
            if (!sections[courseId]) {
                const res = await fetch(`/api/sections?courseId=${courseId}`);
                const data = await res.json();
                setSections(prev => ({ ...prev, [courseId]: data.sections || [] }));
            }
        }
        setExpandedCourses(newSet);
    };

    const handleCreate = async () => {
        let endpoint = "";
        let payload: any = {};
        if (createType === "dept") {
            endpoint = "/api/departments";
            payload = { code: formData.code, name: formData.name, sessionId: selectedSessionId };
        } else if (createType === "subj") {
            endpoint = "/api/subjects";
            payload = { code: formData.code, name: formData.name, departmentId: createParentId };
        } else if (createType === "course") {
            endpoint = "/api/courses";
            payload = { courseNumber: formData.code, title: formData.title, subjectId: createParentId, sessionId: selectedSessionId };
        } else if (createType === "section") {
            endpoint = "/api/sections";
            payload = { sectionNumber: formData.code, courseId: createParentId };
        }

        try {
            const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Failed to create");
            toast.success("Created successfully");
            setCreateType(null);

            // Re-fetch parent level
            if (createType === "dept") {
                fetchDepartments(page);
            } else if (createType === "subj") {
                const sRes = await fetch(`/api/subjects?departmentId=${createParentId}`);
                const sData = await sRes.json();
                setSubjects(prev => ({ ...prev, [createParentId]: sData.subjects || [] }));
            } else if (createType === "course") {
                const cRes = await fetch(`/api/courses?subjectId=${createParentId}`);
                const cData = await cRes.json();
                setCourses(prev => ({ ...prev, [createParentId]: cData.courses || [] }));
            } else if (createType === "section") {
                const secRes = await fetch(`/api/sections?courseId=${createParentId}`);
                const secData = await secRes.json();
                setSections(prev => ({ ...prev, [createParentId]: secData.sections || [] }));
            }
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    return (
        <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Academic Structure</h2>
                    <p className="text-muted-foreground flex items-center gap-1">
                        Manage the department, subject, course, and section hierarchy <HelpTip text="Define the academic framework that exams will map back to." />
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select session" /></SelectTrigger>
                        <SelectContent>{sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between py-4 border-b bg-muted/20">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FolderTree className="h-5 w-5 text-muted-foreground" />
                        Hierarchy Browser
                    </CardTitle>
                    <Dialog open={createType === "dept"} onOpenChange={(o) => { if (!o) setCreateType(null); else setCreateType("dept"); }}>
                        <DialogTrigger asChild>
                            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Department</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Add Department</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2"><Label>Code (e.g. ENG)</Label><Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Name (e.g. Engineering)</Label><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                                <Button onClick={handleCreate} className="w-full">Create</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent className="p-0">
                    {departments.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">No departments found for this session.</div>
                    ) : (
                        <div className="divide-y">
                            {departments.map(dept => (
                                <div key={dept.id} className="flex flex-col">
                                    <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleDept(dept.id)}>
                                            {expandedDepts.has(dept.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            <Building className="h-4 w-4 text-blue-500" />
                                            <span className="font-semibold">{dept.code}</span>
                                            <span className="text-muted-foreground text-sm">- {dept.name}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="text-xs bg-muted px-2 py-1 rounded-full">{dept._count.subjects} Subjects</span>
                                            <Button variant="ghost" size="sm" className="h-7 cursor-pointer" onClick={() => { setCreateType("subj"); setCreateParentId(dept.id); }}><Plus className="h-3 w-3 mr-1" /> Subject</Button>
                                        </div>
                                    </div>

                                    {expandedDepts.has(dept.id) && (
                                        <div className="ml-6 border-l-2 pl-2">
                                            {(subjects[dept.id] || []).map(subj => (
                                                <div key={subj.id} className="flex flex-col border-l border-b border-muted/50 last:border-b-0">
                                                    <div className="flex items-center justify-between p-2 hover:bg-muted/50 transition-colors">
                                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleSubject(subj.id)}>
                                                            {expandedSubjects.has(subj.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                            <Layers className="h-4 w-4 text-emerald-500" />
                                                            <span className="font-medium">{subj.code}</span>
                                                            <span className="text-muted-foreground text-sm">- {subj.name}</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <span className="text-xs bg-muted px-2 py-1 rounded-full">{subj._count?.courses || 0} Courses</span>
                                                            <Button variant="ghost" size="sm" className="h-6 text-xs cursor-pointer" onClick={() => { setCreateType("course"); setCreateParentId(subj.id); }}><Plus className="h-3 w-3 mr-1" /> Course</Button>
                                                        </div>
                                                    </div>

                                                    {expandedSubjects.has(subj.id) && (
                                                        <div className="ml-6 border-l-2 pl-2 bg-muted/5">
                                                            {(courses[subj.id] || []).map(course => (
                                                                <div key={course.id} className="flex flex-col border-b border-muted/50 last:border-b-0">
                                                                    <div className="flex items-center justify-between p-2 text-sm hover:bg-muted/50">
                                                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleCourse(course.id)}>
                                                                            {expandedCourses.has(course.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                                            <BookOpen className="h-4 w-4 text-violet-500" />
                                                                            <span>{subj.code} {course.courseNumber}</span>
                                                                            <span className="text-muted-foreground">- {course.title}</span>
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">{course._count?.sections || 0} Sections</span>
                                                                            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 cursor-pointer" onClick={() => { setCreateType("section"); setCreateParentId(course.id); }}><Plus className="h-3 w-3 mr-1" /> Section</Button>
                                                                        </div>
                                                                    </div>

                                                                    {expandedCourses.has(course.id) && (
                                                                        <div className="ml-8 border-l pl-2 py-1 flex flex-wrap gap-2">
                                                                            {(sections[course.id] || []).map(sec => (
                                                                                <div key={sec.id} className="flex items-center gap-1.5 text-xs bg-background border px-2 py-1 rounded-md shadow-sm">
                                                                                    <Hash className="h-3 w-3 text-amber-500" />
                                                                                    Section {sec.sectionNumber}
                                                                                    <span className="text-muted-foreground ml-1">({sec._count?.enrollments || 0} students)</span>
                                                                                </div>
                                                                            ))}
                                                                            {(sections[course.id] || []).length === 0 && <span className="text-xs text-muted-foreground italic">No sections</span>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            {(courses[subj.id] || []).length === 0 && <div className="p-2 text-xs text-muted-foreground italic">No courses</div>}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {(subjects[dept.id] || []).length === 0 && <div className="p-3 text-sm text-muted-foreground italic border-l">No subjects</div>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
            <DataPagination page={page} totalPages={totalPages} onPageChange={setPage} />

            {/* Shared Creation Dialogs for intermediate levels */}
            <Dialog open={createType !== null && createType !== "dept"} onOpenChange={(o) => !o && setCreateType(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {createType === "subj" ? "Add Subject" : createType === "course" ? "Add Course" : "Add Section"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {createType === "subj" && (
                            <>
                                <div className="space-y-2"><Label>Subject Code</Label><Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Subject Name</Label><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                            </>
                        )}
                        {createType === "course" && (
                            <>
                                <div className="space-y-2"><Label>Course Number</Label><Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Course Title</Label><Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
                            </>
                        )}
                        {createType === "section" && (
                            <>
                                <div className="space-y-2"><Label>Section Number (e.g. 001)</Label><Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} /></div>
                            </>
                        )}
                        <Button onClick={handleCreate} className="w-full">Create</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
