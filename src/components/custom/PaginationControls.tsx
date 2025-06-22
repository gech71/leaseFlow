
"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PaginationControls({ currentPage, totalPages, onPageChange, className }: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = () => {
    const delta = 1;
    const range = [];
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
        range.push(i);
    }

    if (currentPage - delta > 2) {
        range.unshift("...");
    }
    if (currentPage + delta < totalPages - 1) {
        range.push("...");
    }

    range.unshift(1);
    if (totalPages > 1) {
        range.push(totalPages);
    }
    
    // Remove duplicates that might occur if totalPages is small
    const uniqueRange = [...new Set(range)];
    // If we have "... 2", it's because current page is 3. Change "..." to 2.
    if(uniqueRange[1] === '...' && uniqueRange[2] === 3) {
      uniqueRange[1] = 2;
    }
    // If we have "totalPages-2 ... totalPages", change "..." to totalPages-1
    if(uniqueRange[uniqueRange.length - 3] === totalPages - 2 && uniqueRange[uniqueRange.length - 2] === '...') {
      uniqueRange[uniqueRange.length - 2] = totalPages - 1;
    }

    return uniqueRange;
  };

  return (
    <div className={className}>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => { e.preventDefault(); onPageChange(Math.max(1, currentPage - 1)); }}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
          {pageNumbers().map((page, index) =>
            typeof page === "number" ? (
              <PaginationItem key={page}>
                <PaginationLink href="#" onClick={(e) => { e.preventDefault(); onPageChange(page); }} isActive={currentPage === page}>
                  {page}
                </PaginationLink>
              </PaginationItem>
            ) : (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => { e.preventDefault(); onPageChange(Math.min(totalPages, currentPage + 1)); }}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
