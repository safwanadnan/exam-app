import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CalendarDays, GraduationCap, Users } from "lucide-react";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  // Fetch high-level stats
  const [sessionCount, roomCount, examCount, studentCount, activeRuns] = await Promise.all([
    prisma.academicSession.count(),
    prisma.room.count(),
    prisma.exam.count(),
    prisma.student.count(),
    prisma.solverRun.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
  ]);

  const recentSessions = await prisma.academicSession.findMany({
    take: 3,
    orderBy: { year: "desc" },
    include: {
      _count: { select: { examTypes: true, solverRuns: true } }
    }
  });

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center space-x-2">
          {activeRuns > 0 && (
            <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              {activeRuns} Active Solver {activeRuns === 1 ? 'Run' : 'Runs'}
            </div>
          )}
          <Button asChild>
            <Link href="/solver">Go to Solver</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Academic Sessions</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessionCount}</div>
            <p className="text-xs text-muted-foreground">Terms configured</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{examCount}</div>
            <p className="text-xs text-muted-foreground">Across all sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{studentCount}</div>
            <p className="text-xs text-muted-foreground">Enrolled in system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rooms Configured</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roomCount}</div>
            <p className="text-xs text-muted-foreground">Available for scheduling</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {recentSessions.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No sessions configured yet.</div>
              ) : (
                recentSessions.map((session: any) => (
                  <div key={session.id} className="flex items-center">
                    <div className="ml-4 space-y-1">
                      <Link href={`/sessions/${session.id}`} className="text-sm font-medium leading-none hover:underline">
                        {session.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {session.term} {session.year}
                      </p>
                    </div>
                    <div className="ml-auto font-medium text-sm text-muted-foreground flex gap-4">
                      <span>{session._count.examTypes} Exam Types</span>
                      <span>{session._count.solverRuns} Solver Runs</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground font-medium mb-2">Follow these steps to generate a schedule:</div>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li className="pl-1"><Link href="/sessions" className="text-primary hover:underline">Create a Session</Link></li>
                <li className="pl-1"><Link href="/rooms" className="text-primary hover:underline">Configure Rooms</Link></li>
                <li className="pl-1"><Link href="/import" className="text-primary hover:underline">Import Exam & Student Data</Link></li>
                <li className="pl-1"><Link href="/periods" className="text-primary hover:underline">Configure Time Periods</Link></li>
                <li className="pl-1"><Link href="/solver" className="text-primary hover:underline">Run the Solver</Link></li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
