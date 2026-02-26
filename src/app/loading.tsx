import { Loader2 } from "lucide-react";

export default function Loading() {
    return (
        <div className="flex flex-1 items-center justify-center p-8">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        </div>
    );
}
