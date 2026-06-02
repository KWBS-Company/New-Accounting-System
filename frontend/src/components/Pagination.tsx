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
      <div className="px-4 py-3 text-xs font-mono text-ink-500 border-t border-sand bg-parchment-100/30">
        Showing {total} {total === 1 ? 'entry' : 'entries'}
      </div>
    )
  }

  return (
    <div className="px-4 py-3 flex items-center justify-between border-t border-sand bg-parchment-100/30">
      <div className="text-xs font-mono text-ink-500">
        {from}–{to} of {total}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn-ghost text-xs disabled:opacity-30"
        >
          ← Prev
        </button>
        <span className="font-mono text-xs text-ink-500 px-3">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-ghost text-xs disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
