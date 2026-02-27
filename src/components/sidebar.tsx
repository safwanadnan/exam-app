"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    CalendarDays,
    Building2,
    GraduationCap,
    Users,
    UserCog,
    Clock,
    Settings2,
    CalendarCheck,
    BarChart3,
    DatabaseZap,
    PieChart,
    FileSpreadsheet
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/tip";

const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, tip: "Live overview of your scheduling data and solver activity" },
    { name: "Sessions", href: "/sessions", icon: CalendarDays, tip: "Manage academic terms/semesters for exam scheduling" },
    { name: "Rooms & Buildings", href: "/rooms", icon: Building2, tip: "Configure buildings and rooms available for exam scheduling" },
    { name: "Exams & Courses", href: "/exams", icon: GraduationCap, tip: "View and manage exams, their duration, and room requirements" },
    { name: "Students", href: "/students", icon: Users, tip: "Student directory and enrollment tracking" },
    { name: "Instructors", href: "/instructors", icon: UserCog, tip: "Manage instructors and their exam assignments for conflict avoidance" },
    { name: "Exam Periods", href: "/periods", icon: Clock, tip: "Define available time slots when exams can be scheduled" },
    { name: "Constraints", href: "/constraints", icon: Settings2, tip: "Set distribution rules between exam pairs (same room, different day, etc.)" },
];

const solverNav = [
    { name: "Solver Configuration", href: "/solver/config", icon: Settings2, tip: "Tune optimization weights and algorithm parameters" },
    { name: "Solver Dashboard", href: "/solver", icon: BarChart3, tip: "Launch the optimizer and monitor solving progress in real-time" },
    { name: "Schedule View", href: "/schedule", icon: CalendarCheck, tip: "View the generated exam schedule in a timetable grid" },
    { name: "Analytics", href: "/analytics", icon: PieChart, tip: "Analyze student conflicts, room utilization, and scheduling quality" },
    { name: "Data Import", href: "/import", icon: DatabaseZap, tip: "Bulk import data from JSON format" },
    { name: "Excel Import", href: "/import/excel", icon: FileSpreadsheet, tip: "Import rooms, students, exams, and enrollments from XLSX/CSV files" },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex h-full w-64 flex-col border-r bg-muted/20">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <CalendarCheck className="h-6 w-6 text-primary" />
                    <span className="text-lg">Exam Scheduler</span>
                </Link>
            </div>

            <div className="flex-1 overflow-auto py-4">
                <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                    <div className="mb-2 px-4 text-xs font-semibold tracking-tight text-muted-foreground uppercase h-6 flex items-center">
                        Data Management
                    </div>
                    {navigation.map((item) => (
                        <Tip key={item.name} content={item.tip} side="right">
                            <Link
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all w-full",
                                    pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
                                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.name}
                            </Link>
                        </Tip>
                    ))}

                    <div className="mt-6 mb-2 px-4 text-xs font-semibold tracking-tight text-muted-foreground uppercase h-6 flex items-center">
                        Optimization Engine
                    </div>
                    {solverNav.map((item) => (
                        <Tip key={item.name} content={item.tip} side="right">
                            <Link
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all w-full",
                                    pathname === item.href
                                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.name}
                            </Link>
                        </Tip>
                    ))}
                </nav>
            </div>

            <div className="p-4 border-t">
                <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        AD
                    </div>
                    <div className="flex flex-col">
                        <span className="font-medium text-foreground">Admin User</span>
                        <span className="text-xs">University Scheduler</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
