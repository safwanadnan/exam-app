"use client";

import { Search, WholeWord, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tip } from "@/components/tip";
import { cn } from "@/lib/utils";

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    exactMatch: boolean;
    onExactMatchChange: (v: boolean) => void;
    placeholder?: string;
    className?: string;
}

/**
 * Search input with a VS Code-style "exact match" toggle button (Aa icon).
 * When exact match is ON the border turns primary-coloured so the user knows it's active.
 */
export function SearchInput({
    value,
    onChange,
    exactMatch,
    onExactMatchChange,
    placeholder = "Search...",
    className,
}: SearchInputProps) {
    return (
        <div className={cn("relative flex items-center", className)}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />

            <Input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                className={cn(
                    "pl-8 pr-16 bg-background transition-colors",
                    exactMatch && "border-primary ring-1 ring-primary/30"
                )}
            />

            {/* Clear button — only shown when there is text */}
            {value && (
                <button
                    type="button"
                    onClick={() => onChange("")}
                    className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}

            {/* Exact-match toggle */}
            <Tip content={exactMatch ? "Exact match ON — disable for partial search" : "Exact match OFF — enable to match the full term only"}>
                <button
                    type="button"
                    onClick={() => onExactMatchChange(!exactMatch)}
                    aria-label="Toggle exact match"
                    aria-pressed={exactMatch}
                    className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded transition-colors",
                        exactMatch
                            ? "text-primary bg-primary/10 hover:bg-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                >
                    <WholeWord className="h-3.5 w-3.5" />
                </button>
            </Tip>
        </div>
    );
}
