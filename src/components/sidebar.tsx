"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    CalendarDays,
    Building2,
    GraduationCap,
    Users,
    Clock,
    Settings2,
    CalendarCheck,
    BarChart3,
    DatabaseZap,
    PieChart,
    FileSpreadsheet
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Sessions", href: "/sessions", icon: CalendarDays },
    { name: "Rooms & Buildings", href: "/rooms", icon: Building2 },
    { name: "Exams & Courses", href: "/exams", icon: GraduationCap },
    { name: "Students & Instructors", href: "/students", icon: Users },
    { name: "Exam Periods", href: "/periods", icon: Clock },
    { name: "Constraints", href: "/constraints", icon: Settings2 },
];

const solverNav = [
    { name: "Solver Configuration", href: "/solver/config", icon: Settings2 },
    { name: "Solver Dashboard", href: "/solver", icon: BarChart3 },
    { name: "Schedule View", href: "/schedule", icon: CalendarCheck },
    { name: "Analytics", href: "/analytics", icon: PieChart },
    { name: "Data Import", href: "/import", icon: DatabaseZap },
    { name: "Excel Import", href: "/import/excel", icon: FileSpreadsheet },
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
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all",
                                pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.name}
                        </Link>
                    ))}

                    <div className="mt-6 mb-2 px-4 text-xs font-semibold tracking-tight text-muted-foreground uppercase h-6 flex items-center">
                        Optimization Engine
                    </div>
                    {solverNav.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all",
                                pathname === item.href
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.name}
                        </Link>
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
