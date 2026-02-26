"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-center max-w-md">
                <div className="rounded-full bg-destructive/10 p-4">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Something went wrong</h2>
                <p className="text-sm text-muted-foreground">
                    {error.message || "An unexpected error occurred. Please try again."}
                </p>
                <div className="flex gap-2">
                    <Button onClick={() => reset()}>Try Again</Button>
                    <Button variant="outline" onClick={() => window.location.href = "/"}>
                        Go to Dashboard
                    </Button>
                </div>
            </div>
        </div>
    );
}
