"use client";

import { useEffect, useState, useRef } from "react";
import { FileSpreadsheet, Upload, Loader2, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const SHEET_TYPES = [
    { value: "rooms", label: "Rooms & Buildings", desc: "Columns: building_code, building_name, room, capacity" },
    { value: "students", label: "Students", desc: "Columns: id, name" },
    { value: "exams", label: "Exams", desc: "Columns: name, length, max_rooms (requires session)" },
    { value: "enrollments", label: "Student Enrollments", desc: "Columns: student_id, exam" },
];

export default function ExcelImportPage() {
    const [sheetType, setSheetType] = useState("rooms");
    const [file, setFile] = useState<File | null>(null);
    const [sessionId, setSessionId] = useState("");
    const [sessions, setSessions] = useState<any[]>([]);
    const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
    const [result, setResult] = useState<any>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch("/api/sessions").then(r => r.json()).then(d => {
            setSessions(d.sessions || []);
            if (d.sessions?.length) setSessionId(d.sessions[0].id);
        });
    }, []);

    const handleUpload = async () => {
        if (!file) { toast.error("Select a file first"); return; }
        setStatus("uploading");
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("sheetType", sheetType);
            if (sheetType === "exams") formData.append("sessionId", sessionId);

            const res = await fetch("/api/import/excel", { method: "POST", body: formData });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Import failed");

            setResult(data);
            setStatus("success");
            toast.success(`Imported ${data.imported}/${data.total} rows`);
        } catch (e: any) {
            setStatus("error");
            setResult({ error: e.message });
            toast.error(e.message);
        }
    };

    const downloadTemplate = () => {
        const templates: Record<string, string> = {
            rooms: "building_code,building_name,room,capacity\nESB,Engineering Science,101,150\nESB,Engineering Science,102,200",
            students: "id,name\nS001,Alice Smith\nS002,Bob Johnson",
            exams: "name,length,max_rooms\nCS101 Final,120,1\nMATH201 Midterm,90,2",
            enrollments: "student_id,exam\nS001,CS101 Final\nS002,CS101 Final",
        };
        const blob = new Blob([templates[sheetType] || ""], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url;
        link.download = `template_${sheetType}.csv`; link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Excel Import</h2>
                    <p className="text-muted-foreground mt-1">Import data from Excel/CSV spreadsheets</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5" /> Upload Spreadsheet
                        </CardTitle>
                        <CardDescription>Select the data type and upload an XLSX or CSV file</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Data Type</Label>
                            <Select value={sheetType} onValueChange={setSheetType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {SHEET_TYPES.map(t => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {SHEET_TYPES.find(t => t.value === sheetType)?.desc}
                            </p>
                        </div>

                        {sheetType === "exams" && (
                            <div className="grid gap-2">
                                <Label>Session</Label>
                                <Select value={sessionId} onValueChange={setSessionId}>
                                    <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                                    <SelectContent>
                                        {sessions.map((s: any) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name} ({s.term} {s.year})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label>File</Label>
                            <div
                                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => fileRef.current?.click()}
                            >
                                <input
                                    ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                                    className="hidden" onChange={e => { setFile(e.target.files?.[0] || null); setStatus("idle"); setResult(null); }}
                                />
                                {file ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                                        <span className="font-medium">{file.name}</span>
                                        <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                                    </div>
                                ) : (
                                    <div>
                                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">Click to select XLSX, XLS, or CSV</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="justify-between border-t pt-4">
                        <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                            <Download className="mr-2 h-4 w-4" /> Template CSV
                        </Button>
                        <Button onClick={handleUpload} disabled={!file || status === "uploading"}>
                            {status === "uploading" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</> :
                                <><Upload className="mr-2 h-4 w-4" /> Import Data</>}
                        </Button>
                    </CardFooter>
                </Card>

                {/* Results */}
                <Card>
                    <CardHeader>
                        <CardTitle>Import Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {status === "idle" && (
                            <div className="p-8 text-center text-muted-foreground">
                                <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 opacity-40" />
                                Upload a file to see import results
                            </div>
                        )}
                        {status === "uploading" && (
                            <div className="p-8 text-center"><Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" /></div>
                        )}
                        {status === "success" && result && (
                            <div className="space-y-4">
                                <Alert className="bg-emerald-500/10 border-emerald-500/20">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <AlertTitle>Import Complete</AlertTitle>
                                    <AlertDescription>
                                        Successfully imported <strong>{result.imported}</strong> of {result.total} rows
                                    </AlertDescription>
                                </Alert>

                                {result.headers && (
                                    <div>
                                        <p className="text-sm font-medium mb-2">Detected Columns:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {result.headers.map((h: string) => (
                                                <Badge key={h} variant="secondary" className="text-xs">{h}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {result.errors?.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium text-destructive mb-2">Errors ({result.errors.length}):</p>
                                        <div className="max-h-40 overflow-auto text-xs bg-destructive/5 rounded-md p-3 space-y-1">
                                            {result.errors.map((e: string, i: number) => (
                                                <div key={i} className="text-destructive">{e}</div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {status === "error" && result?.error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{result.error}</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
