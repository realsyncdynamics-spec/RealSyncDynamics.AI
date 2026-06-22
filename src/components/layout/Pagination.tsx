import React from 'react';
import { SovereignButton } from '../ui/SovereignButton';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
  className?: string;
  showFirstLast?: boolean;
}

export const Pagination = React.forwardRef<HTMLNavElement, PaginationProps>(
  (
    {
      currentPage,
      totalPages,
      onPageChange,
      maxVisiblePages = 5,
      className = '',
      showFirstLast = true,
    },
    ref
  ) => {
    const getPageNumbers = () => {
      const pages: (number | string)[] = [];
      const halfVisible = Math.floor(maxVisiblePages / 2);

      let startPage = Math.max(1, currentPage - halfVisible);
      let endPage = Math.min(totalPages, currentPage + halfVisible);

      if (currentPage - halfVisible < 1) {
        endPage = Math.min(totalPages, endPage + (halfVisible - currentPage + 1));
      }
      if (currentPage + halfVisible > totalPages) {
        startPage = Math.max(1, startPage - (currentPage + halfVisible - totalPages));
      }

      if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) pages.push('...');
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }

      return pages;
    };

    const pages = getPageNumbers();
    const canGoPrev = currentPage > 1;
    const canGoNext = currentPage < totalPages;

    return (
      <nav
        ref={ref}
        aria-label="Pagination"
        className={`flex items-center justify-center gap-2 ${className}`}
      >
        {showFirstLast && (
          <SovereignButton
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={!canGoPrev}
            aria-label="First page"
          >
            {'<<'}
          </SovereignButton>
        )}

        <SovereignButton
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
          aria-label="Previous page"
        >
          {'<'}
        </SovereignButton>

        {pages.map((page, index) => (
          <React.Fragment key={index}>
            {page === '...' ? (
              <span className="px-2 text-titanium/50">…</span>
            ) : (
              <SovereignButton
                variant={currentPage === page ? 'primary' : 'outline'}
                size="sm"
                onClick={() => typeof page === 'number' && onPageChange(page)}
                disabled={typeof page === 'string'}
                aria-label={`Page ${page}`}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </SovereignButton>
            )}
          </React.Fragment>
        ))}

        <SovereignButton
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          aria-label="Next page"
        >
          {'>'}
        </SovereignButton>

        {showFirstLast && (
          <SovereignButton
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={!canGoNext}
            aria-label="Last page"
          >
            {'>>'}
          </SovereignButton>
        )}
      </nav>
    );
  }
);

Pagination.displayName = 'Pagination';
