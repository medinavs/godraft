import { forwardRef } from 'react'
import { Copy, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { timeAgo } from '@/shared/lib/utils'
import type { Note } from './types'

interface Props {
  workspaceName: string
  notes: Note[]
  activeId: string | null
  query: string
  onQuery: (q: string) => void
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onDuplicate: (note: Note) => void
  onTogglePin: (note: Note) => void
}

export const NotesSidebar = forwardRef<HTMLInputElement, Props>(function NotesSidebar(
  { workspaceName, notes, activeId, query, onQuery, onSelect, onCreate, onDelete, onDuplicate, onTogglePin },
  searchRef,
) {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-border bg-surface">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 truncate">
          <div className="h-2 w-2 rounded-full bg-emerald-400" title="live" />
          <span className="truncate font-mono text-sm text-muted">{workspaceName}</span>
        </div>
        <Button size="icon" variant="ghost" onClick={onCreate} title="New note (Ctrl+N)">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search  (Ctrl+K)"
            className="pl-8"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {notes.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted">No notes yet.</p>
        )}
        {notes.map((note) => (
          <div
            key={note.id}
            onClick={() => onSelect(note.id)}
            className={`group mb-1 cursor-pointer rounded-lg px-3 py-2 transition-colors ${
              note.id === activeId ? 'bg-elevated' : 'hover:bg-elevated/60'
            }`}
          >
            <div className="flex items-center gap-2">
              {note.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
              <span className="flex-1 truncate text-sm font-medium text-fg">
                {note.title || 'Untitled'}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-xs text-muted">{timeAgo(note.updated_at)}</span>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <IconBtn title={note.pinned ? 'Unpin' : 'Pin'} onClick={(e) => stop(e, () => onTogglePin(note))}>
                  {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </IconBtn>
                <IconBtn title="Duplicate" onClick={(e) => stop(e, () => onDuplicate(note))}>
                  <Copy className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn title="Delete" onClick={(e) => stop(e, () => onDelete(note.id))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
})

function stop(e: React.MouseEvent, fn: () => void) {
  e.stopPropagation()
  fn()
}

function IconBtn({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded p-1 text-muted hover:bg-surface hover:text-fg"
    >
      {children}
    </button>
  )
}
