"use client";

import { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

/**
 * Inline tooltip wrapper — wraps children with a tooltip on hover.
 * Usage: <Tip content="Helpful text">Click me</Tip>
 */
export function Tip({ children, content, side = "top" }: {
    children: ReactNode;
    content: string;
    side?: "top" | "bottom" | "left" | "right";
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side={side}><p>{content}</p></TooltipContent>
        </Tooltip>
    );
}

/**
 * Small help icon with tooltip — place next to labels for contextual help.
 * Usage: <HelpTip text="This field controls..." />
 */
export function HelpTip({ text, side = "top" }: { text: string; side?: "top" | "bottom" | "left" | "right" }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help inline-block ml-1 shrink-0" />
            </TooltipTrigger>
            <TooltipContent side={side}><p>{text}</p></TooltipContent>
        </Tooltip>
    );
}
