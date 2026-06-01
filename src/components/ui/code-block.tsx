import * as React from "react";
import { cn } from "@/lib/utils";

export function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <pre className={cn("rounded-md p-4 overflow-auto bg-surface-dark text-on-dark text-sm", className)}>
      <code>{children}</code>
    </pre>
  );
}
