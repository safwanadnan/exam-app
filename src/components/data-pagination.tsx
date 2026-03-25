import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

export function DataPagination({
    page,
    totalPages,
    onPageChange
}: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}) {
    if (totalPages <= 1) return null;

    return (
        <Pagination className="mt-4 justify-end">
            <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); if (page > 1) onPageChange(page - 1); }}
                        className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                </PaginationItem>
                <PaginationItem>
                    <span className="text-sm text-muted-foreground px-4">Page {page} of {totalPages}</span>
                </PaginationItem>
                <PaginationItem>
                    <PaginationNext
                        href="#"
                        onClick={(e) => { e.preventDefault(); if (page < totalPages) onPageChange(page + 1); }}
                        className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    );
}
