"use client";

import { useState } from "react";
import { DatabaseZap, FileJson, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

export default function DataImportPage() {
    const [jsonInput, setJsonInput] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const handleImport = async () => {
        try {
            setStatus("loading");
            const parsedData = JSON.parse(jsonInput);

            const res = await fetch("/api/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(parsedData),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Import failed");
            }

            setStatus("success");
            setMessage(`Successfully imported session, ${data.rooms} rooms, ${data.periods} periods, and ${data.exams} exams.`);
            setJsonInput("");
        } catch (e: any) {
            setStatus("error");
            setMessage(e.message || "Invalid JSON format");
        }
    };

    const loadExample = () => {
        const example = {
            session: {
                name: "Mock Fall 2026",
                term: "Fall",
                year: "2026",
                startDate: "2026-09-01T00:00:00Z",
                endDate: "2026-12-15T00:00:00Z"
            },
            rooms: [
                { name: "101", building: { code: "ESB", name: "Engineering Science" }, capacity: 150, coordX: 50.1, coordY: 10.2 }
            ],
            periods: [
                { date: "2026-12-10T00:00:00Z", startTime: "09:00", endTime: "11:00", length: 120, penalty: 0, examType: "Final" }
            ],
            exams: [
                {
                    name: "CS101 Final",
                    examType: "Final",
                    length: 120,
                    maxRooms: 1,
                    students: ["S001", "S002"]
                }
            ]
        };
        setJsonInput(JSON.stringify(example, null, 2));
    };

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Data Integration</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileJson className="h-5 w-5" /> Bulk JSON Import
                        </CardTitle>
                        <CardDescription>
                            Import structural scheduling data in a single transaction.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-4">
                        {status === "success" && (
                            <Alert className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <AlertTitle>Success</AlertTitle>
                                <AlertDescription>{message}</AlertDescription>
                            </Alert>
                        )}

                        {status === "error" && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{message}</AlertDescription>
                            </Alert>
                        )}

                        <div className="flex-1 min-h-[300px] relative">
                            <Textarea
                                placeholder="Paste UniTime JSON format here..."
                                className="min-h-[300px] h-full font-mono text-xs resize-none"
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="justify-between bg-muted/10 border-t py-4">
                        <Button variant="ghost" size="sm" onClick={loadExample}>
                            Load Example Template
                        </Button>
                        <Button
                            onClick={handleImport}
                            disabled={!jsonInput || status === "loading"}
                            className="min-w-[120px]"
                        >
                            {status === "loading" ? "Importing..." : (
                                <><DatabaseZap className="mr-2 h-4 w-4" /> Run Import</>
                            )}
                        </Button>
                    </CardFooter>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Supported Formats</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-4">
                            <p>The system expects a specific JSON schema that combines the session architecture, room topology, and student enrollments.</p>
                            <div className="bg-muted p-3 rounded-md font-mono text-xs text-foreground overflow-auto">
                                {`{
  "session": { "name": "...", "startDate": "..." },
  "rooms": [{ "name": "100", "building": {...} }],
  "periods": [{ "date": "...", "startTime": "09:00" }],
  "exams": [{ "name": "CS101", "students": ["st1"] }]
}`}
                            </div>
                            <p>This data is processed in a single <strong className="text-foreground">transactional bound</strong>—either all data is loaded flawlessly, or the entire operation rolls back to prevent orphan data.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
