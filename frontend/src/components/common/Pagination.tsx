import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  if (total <= pageSize) {
    return (
      <div className="px-4 py-3 text-xs font-mono text-muted-foreground border-t border-border bg-muted/30">
        Showing {total} {total === 1 ? 'entry' : 'entries'}
      </div>
    )
  }

  return (
    <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-border bg-muted/30">
      <div className="text-xs font-mono text-muted-foreground">
        {from}–{to} of {total}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </Button>
        <span className="font-mono text-xs text-muted-foreground px-3">
          {page} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
