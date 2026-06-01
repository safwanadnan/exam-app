import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "blue" | "green" | "red" | "purple";

const variantMeta: Record<Variant, { bg: string; emoji: string; label: string }> = {
  blue: { bg: "bg-accent-blue-soft text-foreground", emoji: "💡", label: "Tip" },
  green: { bg: "bg-accent-green-soft text-foreground", emoji: "✅", label: "Success" },
  red: { bg: "bg-accent-red-soft text-foreground", emoji: "⚠️", label: "Warning" },
  purple: { bg: "bg-accent-purple-soft text-foreground", emoji: "📘", label: "Note" },
};

export function Callout({
  variant = "blue",
  title,
  children,
  className,
}: {
  variant?: Variant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const meta = variantMeta[variant];
  return (
    <div className={cn("rounded-md p-4 pl-6", meta.bg, className)}>
      <div className="flex items-start gap-3">
        <div className="text-xl leading-none mt-0.5">{meta.emoji}</div>
        <div>
          {title && <div className="font-semibold mb-1">{title}</div>}
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
