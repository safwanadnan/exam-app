"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Building2, CalendarDays, GraduationCap, Users, Clock, Settings2, Activity, Loader2, TrendingUp, ArrowRight, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcademicSession } from "@/components/academic-session-provider";

interface DashboardData {
  counts: { sessions: number; rooms: number; exams: number; students: number; periods: number; constraints: number };
  activeRuns: number;
  recentSessions: any[];
  recentRuns: any[];
}

const statCards = [
  { key: "sessions", label: "Sessions", icon: CalendarDays, href: "/sessions", desc: "Terms configured", color: "text-blue-500" },
  { key: "exams", label: "Total Exams", icon: GraduationCap, href: "/exams", desc: "Filtered by session", color: "text-emerald-500" },
  { key: "students", label: "Students", icon: Users, href: "/students", desc: "Enrolled in system", color: "text-violet-500" },
  { key: "rooms", label: "Rooms", icon: Building2, href: "/rooms", desc: "Available for scheduling", color: "text-amber-500" },
  { key: "periods", label: "Periods", icon: Clock, href: "/periods", desc: "Time slots configured", color: "text-rose-500" },
  { key: "constraints", label: "Constraints", icon: Settings2, href: "/constraints", desc: "Distribution rules", color: "text-cyan-500" },
] as const;

export default function DashboardPage() {
  const { currentSessionId, setCurrentSessionId, sessions } = useAcademicSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = currentSessionId ? `/api/stats?sessionId=${currentSessionId}` : "/api/stats";
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [currentSessionId]);

  if (loading && !data) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const counts = data?.counts || { sessions: 0, rooms: 0, exams: 0, students: 0, periods: 0, constraints: 0 };
  const totalEntities = Object.values(counts).reduce((a, b) => a + b, 0);
  const setupProgress = Math.min(100, Math.round(
    ([counts.sessions > 0, counts.rooms > 0, counts.exams > 0, counts.students > 0, counts.periods > 0].filter(Boolean).length / 5) * 100
  ));

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {currentSessionId 
              ? `Filtering data for ${sessions.find(s => s.id === currentSessionId)?.name || 'selected session'}`
              : "Overview of your exam scheduling system"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Active Session:</span>
            <Select value={currentSessionId || ""} onValueChange={setCurrentSessionId}>
              <SelectTrigger className="w-[200px] h-9 bg-background shadow-sm border-primary/20">
                <SelectValue placeholder="Select a session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(data?.activeRuns ?? 0) > 0 && (
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              {data?.activeRuns} Active {data?.activeRuns === 1 ? 'Run' : 'Runs'}
            </div>
          )}
          <Button asChild size="sm" className="hidden lg:flex"><Link href="/solver"><Activity className="mr-2 h-4 w-4" />Go to Solver</Link></Button>
        </div>
      </div>

      {/* Setup Progress */}
      {setupProgress < 100 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Setup Progress</span>
              <span className="text-sm text-muted-foreground">{setupProgress}%</span>
            </div>
            <Progress value={setupProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {setupProgress === 0 ? "Start by creating a session and importing data." :
                setupProgress < 60 ? "Good start! Add rooms and exams to continue." :
                  "Almost there! Configure periods and run the solver."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map(({ key, label, icon: Icon, href, desc, color }) => (
          <Link key={key} href={href}>
            <Card className="hover:shadow-lg hover:border-primary/30 transition-all duration-200 cursor-pointer group">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className={`h-4 w-4 ${color} group-hover:scale-110 transition-transform`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts[key as keyof typeof counts]}</div>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Sessions */}
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Sessions</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/sessions">View all <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
          </CardHeader>
          <CardContent>
            {(data?.recentSessions?.length ?? 0) === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No sessions configured yet.
              </div>
            ) : (
              <div className="space-y-4">
                {data!.recentSessions.map((session: any) => (
                  <div key={session.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <CalendarDays className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{session.name}</p>
                      <p className="text-xs text-muted-foreground">{session.term} {session.year}</p>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{session._count.examTypes} types</span>
                      <span>{session._count.solverRuns} runs</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Solver Runs */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Solver Activity</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/solver">View all <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
          </CardHeader>
          <CardContent>
            {(data?.recentRuns?.length ?? 0) === 0 ? (
              <div className="text-center py-6">
                <div className="text-sm text-muted-foreground font-medium mb-3">Getting Started</div>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground text-left">
                  <li><Link href="/sessions" className="text-primary hover:underline">Create a Session</Link></li>
                  <li><Link href="/rooms" className="text-primary hover:underline">Configure Rooms</Link></li>
                  <li><Link href="/import" className="text-primary hover:underline">Import Exam & Student Data</Link></li>
                  <li><Link href="/periods" className="text-primary hover:underline">Configure Time Periods</Link></li>
                  <li><Link href="/solver" className="text-primary hover:underline">Run the Solver</Link></li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3">
                {data!.recentRuns.map((run: any) => (
                  <div key={run.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${run.status === "COMPLETE" ? "bg-emerald-500/10 text-emerald-500" :
                        run.status === "FAILED" ? "bg-destructive/10 text-destructive" :
                          "bg-primary/10 text-primary"
                      }`}>
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{run.config?.name || "Default"}</p>
                      <p className="text-xs text-muted-foreground">
                        {run.createdAt ? formatDistanceToNow(new Date(run.createdAt), { addSuffix: true }) : "Unknown"}
                      </p>
                    </div>
                    <Badge variant={run.status === "COMPLETE" ? "default" : run.status === "FAILED" ? "destructive" : "secondary"} className="text-xs">
                      {run.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
