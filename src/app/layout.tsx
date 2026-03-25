export const dynamic = 'force-dynamic';
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/mobile-nav";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Exam Scheduler",
  description: "Advanced exam scheduling powered by CPSolver engine",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`${inter.className} h-full overflow-hidden antialiased bg-background`}>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider delayDuration={300}>
              <div className="grid h-full lg:grid-cols-[250px_1fr]">
                <div className="hidden border-r bg-muted/10 lg:block h-full">
                  <Sidebar />
                </div>
                <div className="flex flex-col h-full overflow-hidden">
                  <header className="flex h-14 lg:h-[60px] items-center gap-4 border-b bg-background px-6">
                    <MobileNav />
                    <div className="w-full flex-1">
                      <h1 className="font-semibold text-lg">Exam Scheduler</h1>
                    </div>
                    <ThemeToggle />
                  </header>
                  <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto bg-muted/5">
                    {children}
                  </main>
                </div>
              </div>
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
