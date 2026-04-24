"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Plus, Settings2, Search, MoreHorizontal, Loader2, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { HelpTip } from "@/components/tip";
import { DataPagination } from "@/components/data-pagination";
import { useAcademicSession } from "@/components/academic-session-provider";
import { cn } from "@/lib/utils";

const CONSTRAINT_TYPES = [
  "SAME_ROOM", "DIFF_ROOM", "SAME_PERIOD", "DIFF_PERIOD",
  "PRECEDENCE", "PRECEDENCE_REV", "SAME_DAY", "DIFF_DAY",
  "SAME_INSTRUCTOR", "DIFF_INSTRUCTOR",
];

interface Constraint {
  id: string; type: string; hard: boolean; weight: number;
  examAId: string; examBId: string;
  examA: { name: string; examType?: { session?: { name: string } } };
  examB: { name: string };
}

interface ExamOption { id: string; name: string; }

// ─── Searchable Exam Dropdown ──────────────────────────────────────────────
function SearchableExamSelect({ value, onValueChange, sessionId, initialName, placeholder }: {
  value: string;
  onValueChange: (id: string, name: string) => void;
  sessionId?: string | null;
  initialName?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<ExamOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState(initialName || "");

  useEffect(() => { if (initialName) setSelectedName(initialName); }, [initialName]);

  const fetchExams = async (query = "") => {
    setLoading(true);
    try {
      const base = sessionId ? `/api/exams?limit=50&minimal=true&sessionId=${sessionId}` : `/api/exams?limit=50&minimal=true`;
      const url = query ? `${base}&search=${encodeURIComponent(query)}` : base;
      const data = await (await fetch(url)).json();
      setOptions(data.exams || []);
    } catch { toast.error("Failed to fetch exams"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) fetchExams(search); }, [open]);
  useEffect(() => {
    const t = setTimeout(() => { if (open) fetchExams(search); }, 300);
    return () => clearTimeout(t);
  }, [search, open]);

  return (
    <div className="relative">
      <Button variant="outline" type="button" className="w-full justify-between font-normal" onClick={() => setOpen(!open)}>
        <span className="truncate">{selectedName || placeholder || "Select exam..."}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95">
            <div className="p-2 border-b">
              <Input placeholder="Search exams..." value={search} onChange={e => setSearch(e.target.value)} className="h-8" autoFocus />
            </div>
            <div className="max-h-60 overflow-y-auto p-1">
              {loading && <div className="p-2 text-xs text-center text-muted-foreground">Loading...</div>}
              {!loading && options.length === 0 && <div className="p-2 text-xs text-center text-muted-foreground">No exams found.</div>}
              {options.map(exam => (
                <div
                  key={exam.id}
                  className={cn("relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground", value === exam.id && "bg-accent")}
                  onClick={() => { onValueChange(exam.id, exam.name); setSelectedName(exam.name); setOpen(false); }}
                >
                  <span className="truncate">{exam.name}</span>
                  {value === exam.id && <Check className="absolute right-2 h-4 w-4" />}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Types for multi-constraint form ──────────────────────────────────────
interface ConstraintRow { id: string; type: string; hard: boolean; weight: number; }
interface ExamB { id: string; examId: string; }
const uid = () => Math.random().toString(36).slice(2);

// ─── Add / Edit Constraint Dialog ──────────────────────────────────────────
function ConstraintDialog({ constraint, open, onOpenChange, onSaved }: {
  constraint?: Constraint | null; open: boolean;
  onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const { currentSessionId } = useAcademicSession();
  const isEditing = !!constraint;
  const [saving, setSaving] = useState(false);

  // Edit mode state
  const [editType, setEditType] = useState("SAME_PERIOD");
  const [editHard, setEditHard] = useState(false);
  const [editWeight, setEditWeight] = useState(1);
  const [editExamAId, setEditExamAId] = useState("");
  const [editExamBId, setEditExamBId] = useState("");

  // Add mode state
  const [constraintRows, setConstraintRows] = useState<ConstraintRow[]>([
    { id: uid(), type: "SAME_PERIOD", hard: false, weight: 1 },
  ]);
  const [examAId, setExamAId] = useState("");
  const [examBs, setExamBs] = useState<ExamB[]>([{ id: uid(), examId: "" }]);

  useEffect(() => {
    if (constraint) {
      setEditType(constraint.type); setEditHard(constraint.hard);
      setEditWeight(constraint.weight); setEditExamAId(constraint.examAId); setEditExamBId(constraint.examBId);
    } else {
      setConstraintRows([{ id: uid(), type: "SAME_PERIOD", hard: false, weight: 1 }]);
      setExamAId("");
      setExamBs([{ id: uid(), examId: "" }]);
    }
  }, [constraint, open]);

  const updateRow = (id: string, patch: Partial<ConstraintRow>) =>
    setConstraintRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditing) {
        const res = await fetch(`/api/constraints/${constraint!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: editType, hard: editHard, weight: editWeight, examAId: editExamAId, examBId: editExamBId }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
        toast.success("Constraint updated");
      } else {
        if (!examAId) throw new Error("Please select Exam A.");
        const filledBs = examBs.filter(b => b.examId);
        if (filledBs.length === 0) throw new Error("Please select at least one Exam B.");
        let created = 0;
        for (const cr of constraintRows) {
          for (const b of filledBs) {
            const res = await fetch("/api/constraints", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: cr.type, hard: cr.hard, weight: cr.weight, examAId: examAId, examBId: b.examId }),
            });
            if (!res.ok) {
              const err = await res.json();
              toast.warning(`Skipped: ${err.error || "Already exists"}`);
            } else { created++; }
          }
        }
        toast.success(`${created} constraint(s) created`);
      }
      onOpenChange(false);
      onSaved();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Constraint" : "Add Constraints"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Edit the distribution rule between two exams."
                : "Select exams and define one or more rules. Exam A is paired with every other exam you add."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {isEditing ? (
              /* ── EDIT MODE ─────────────────────────────── */
              <>
                <div className="grid gap-2">
                  <Label>Constraint Type <HelpTip text="The scheduling rule applied between the two exams." /></Label>
                  <Select value={editType} onValueChange={setEditType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CONSTRAINT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Primary Exam (A)</Label>
                  <SearchableExamSelect value={editExamAId} onValueChange={(id) => setEditExamAId(id)} sessionId={currentSessionId} initialName={constraint?.examA?.name} />
                </div>
                <div className="grid gap-2">
                  <Label>Secondary Exam (B)</Label>
                  <SearchableExamSelect value={editExamBId} onValueChange={(id) => setEditExamBId(id)} sessionId={currentSessionId} initialName={constraint?.examB?.name} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch checked={editHard} onCheckedChange={setEditHard} />
                    <Label>Hard Constraint <HelpTip text="Hard constraints must always be satisfied. Soft constraints incur a penalty when violated." /></Label>
                  </div>
                  {!editHard && (
                    <div className="flex items-center gap-2">
                      <Label>Weight</Label>
                      <Input type="number" className="w-20" value={editWeight} onChange={e => setEditWeight(parseInt(e.target.value) || 1)} min={1} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ── ADD MODE ──────────────────────────────── */
              <>
                {/* Constraint rules section */}
                <div className="grid gap-3">
                  <Label className="text-sm font-semibold">
                    Constraint Rules <HelpTip text="Each rule is applied to every exam pair. Rule 1 is required." />
                  </Label>

                  {constraintRows.map((row, idx) => (
                    <div key={row.id} className="rounded-lg border p-3 grid gap-3 bg-muted/20 relative">
                      {idx > 0 && (
                        <button type="button"
                          className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                          onClick={() => setConstraintRows(prev => prev.filter(r => r.id !== row.id))}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono w-20 shrink-0">
                          Rule {idx + 1}{idx === 0 && <span className="text-destructive">*</span>}
                        </span>
                        <div className="flex-1">
                          <Select value={row.type} onValueChange={v => updateRow(row.id, { type: v })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CONSTRAINT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pl-[5.5rem]">
                        <div className="flex items-center space-x-2">
                          <Switch checked={row.hard} onCheckedChange={v => updateRow(row.id, { hard: v })} />
                          <span className="text-sm">Hard constraint</span>
                        </div>
                        {!row.hard && (
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">Weight</Label>
                            <Input type="number" className="w-20 h-8" value={row.weight}
                              onChange={e => updateRow(row.id, { weight: parseInt(e.target.value) || 1 })} min={1} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <Button type="button" variant="outline" size="sm"
                    className="w-full border-dashed text-muted-foreground hover:text-foreground"
                    onClick={() => setConstraintRows(prev => [...prev, { id: uid(), type: "SAME_PERIOD", hard: false, weight: 1 }])}>
                    <Plus className="mr-2 h-3.5 w-3.5" /> Add More Constraints
                  </Button>
                </div>

                {/* Exams section */}
                <div className="border-t pt-4 grid gap-3">
                  <Label className="text-sm font-semibold">
                    Exams <HelpTip text="Exam A is paired with every other exam you add. All constraint rules apply to each A↔B pair." />
                  </Label>

                  {/* Fixed Exam A */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono w-16 shrink-0">Exam A <span className="text-destructive">*</span></span>
                    <div className="flex-1">
                      <SearchableExamSelect
                        value={examAId}
                        onValueChange={(id) => setExamAId(id)}
                        sessionId={currentSessionId}
                        placeholder="Primary exam (required)"
                      />
                    </div>
                  </div>

                  {/* Dynamic Exam Bs */}
                  {examBs.map((b, idx) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono w-16 shrink-0">
                        Exam {String.fromCharCode(66 + idx)}{idx === 0 && <span className="text-destructive">*</span>}
                      </span>
                      <div className="flex-1">
                        <SearchableExamSelect
                          value={b.examId}
                          onValueChange={(id) => setExamBs(prev => prev.map(x => x.id === b.id ? { ...x, examId: id } : x))}
                          sessionId={currentSessionId}
                          placeholder={idx === 0 ? "Secondary exam (required)" : "Additional exam (optional)"}
                        />
                      </div>
                      {idx > 0 && (
                        <button type="button" className="text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => setExamBs(prev => prev.filter(x => x.id !== b.id))}>
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  <Button type="button" variant="outline" size="sm"
                    className="w-full border-dashed text-muted-foreground hover:text-foreground"
                    onClick={() => setExamBs(prev => [...prev, { id: uid(), examId: "" }])}>
                    <Plus className="mr-2 h-3.5 w-3.5" /> Add More Exams
                  </Button>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Dialog ─────────────────────────────────────────────────────────
function DeleteDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void; }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader><DialogTitle>Delete Constraint</DialogTitle><DialogDescription>This action cannot be undone.</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={deleting} onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false); }}>
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function ConstraintsPage() {
  const { currentSessionId } = useAcademicSession();
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editConstraint, setEditConstraint] = useState<Constraint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Constraint | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchData = async (currentPage = page) => {
    setLoading(true);
    try {
      const url = currentSessionId
        ? `/api/constraints?page=${currentPage}&limit=50&sessionId=${currentSessionId}`
        : `/api/constraints?page=${currentPage}&limit=50`;
      const data = await (await fetch(url)).json();
      setConstraints(data.constraints || []);
      setTotalPages(Math.ceil((data.total || 0) / 50) || 1);
    } catch { toast.error("Failed to load data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(page); }, [page, currentSessionId]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/constraints/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Constraint deleted"); setDeleteTarget(null); fetchData();
      setSelectedIds(prev => { const next = new Set(prev); next.delete(deleteTarget.id); return next; });
    } catch (err: any) { toast.error(err.message); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !confirm(`Are you sure you want to delete ${selectedIds.size} constraints?`)) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/constraints", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Bulk delete failed");
      toast.success(`${selectedIds.size} constraints deleted`);
      setSelectedIds(new Set());
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = constraints.filter(c =>
    search === "" ||
    c.type.toLowerCase().includes(search.toLowerCase()) ||
    (c.examA.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Distribution Constraints</h2>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button onClick={() => { setEditConstraint(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Constraint</Button>
        </div>
      </div>
      <div className="flex items-center space-x-2 pb-2">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search constraints..." className="pl-8 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Global Rules</CardTitle>
          <CardDescription>Manage hard and soft distribution constraints between specific exams.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 border border-dashed rounded-lg">
              <Settings2 className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
              <h3 className="font-semibold text-lg">No constraints found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">Distribution constraints map rules between two specific exams.</p>
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader className="bg-muted/5">
                  <TableRow>
                    <TableHead className="w-[40px] px-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-[180px]">Type</TableHead>
                    <TableHead>Exam A</TableHead>
                    <TableHead>Exam B</TableHead>
                    <TableHead className="text-center w-[120px]">Enforcement</TableHead>
                    <TableHead className="text-right w-[100px]">Weight</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id} className={selectedIds.has(c.id) ? "bg-muted/50" : ""}>
                      <TableCell className="px-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium font-mono text-xs">{c.type}</TableCell>
                      <TableCell>{c.examA.name || "Unnamed"}</TableCell>
                      <TableCell>{c.examB.name || "Unnamed"}</TableCell>
                      <TableCell className="text-center">
                        {c.hard
                          ? <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">HARD</span>
                          : <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">SOFT</span>}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{c.hard ? "—" : c.weight}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditConstraint(c); setFormOpen(true); }}>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(c)}>Delete</DropdownMenuItem>
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
      <DataPagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <ConstraintDialog constraint={editConstraint} open={formOpen} onOpenChange={setFormOpen} onSaved={() => fetchData(page)} />
      <DeleteDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }} onConfirm={handleDelete} />
    </div>
  );
}
