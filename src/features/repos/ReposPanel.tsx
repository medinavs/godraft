import { useEffect, useRef, useState } from 'react'
import { ClipboardPaste, Download, FolderGit2, FolderOpen, Loader2, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { useDialog } from '@/shared/components/ui/dialog'
import { formatBytes, timeAgo } from '@/shared/lib/utils'
import { exportRepo, type Repo } from './reposService'
import type { ImportState, ReposApi } from './useRepos'

const hasFiles = (dt: DataTransfer) => dt.files.length > 0 || Array.from(dt.items).some((i) => i.kind === 'file')

export function ReposPanel({
  api,
  activeId,
  onOpen,
}: {
  api: ReposApi
  activeId: string | null
  onOpen: (id: string) => void
}) {
  const { repos, state, importFrom, cancel, dismiss, remove } = api
  const dlg = useDialog()
  const pickerRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<Repo | null>(null) // set by "Update": next paste replaces this repo
  const [dragging, setDragging] = useState(false)
  const [zipping, setZipping] = useState<string | null>(null)
  const busy = state.phase === 'detecting' || state.phase === 'importing'

  const start = (src: DataTransfer | FileList) => {
    importFrom(src, target)
    setTarget(null)
  }

  // Ctrl/Cmd+V anywhere while this tab is open. Plain text pasted into an input stays a normal paste.
  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      const dt = e.clipboardData
      if (!dt || busy) return
      if (!hasFiles(dt) && (e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"]'))
        return
      e.preventDefault()
      start(dt)
    }
    window.addEventListener('paste', h)
    return () => window.removeEventListener('paste', h)
  })

  const download = async (repo: Repo) => {
    setZipping(repo.id)
    try {
      await exportRepo(repo)
    } catch (err) {
      await dlg.confirm({ title: 'Download failed', message: (err as Error).message, confirmText: 'OK' })
    } finally {
      setZipping(null)
    }
  }

  const q = query.trim().toLowerCase()
  const shown = q ? repos.filter((r) => r.name.toLowerCase().includes(q)) : repos

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 px-3 pb-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search repos" className="pl-8" />
        </div>
        <Button size="icon" variant="ghost" onClick={() => pickerRef.current?.click()} disabled={busy} title="Choose folder">
          <FolderOpen className="h-4 w-4" />
        </Button>
        <input
          ref={pickerRef}
          type="file"
          hidden
          // @ts-expect-error non-standard but supported by every current browser
          webkitdirectory=""
          onChange={(e) => {
            if (e.target.files?.length) start(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <div
        tabIndex={0}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!busy) start(e.dataTransfer)
        }}
        className={`mx-3 mb-2 rounded-lg border border-dashed p-4 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60 ${
          dragging ? 'border-primary bg-primary/10' : 'border-border'
        }`}
      >
        <ClipboardPaste className="mx-auto mb-2 h-6 w-6 text-primary" />
        <p className="text-sm font-medium text-fg">
          {target ? `Paste the new version of ${target.name}` : 'Paste your repository here'}
        </p>
        <p className="mt-1 text-xs text-muted">
          Copy a folder (or a .zip of it) and press Ctrl+V — or drop it here.
        </p>
        {target && (
          <button type="button" onClick={() => setTarget(null)} className="mt-2 text-xs text-muted hover:text-fg">
            Cancel update
          </button>
        )}
      </div>

      <ImportStatus state={state} onCancel={cancel} onDismiss={dismiss} />

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {shown.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted">{q ? 'No matching repos.' : 'No repos yet.'}</p>
        )}
        {shown.map((repo) => (
          <div
            key={repo.id}
            onClick={() => onOpen(repo.id)}
            className={`group mb-1 cursor-pointer rounded-lg px-3 py-2 transition-colors ${
              repo.id === activeId ? 'bg-elevated' : 'hover:bg-elevated/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 truncate text-sm font-medium text-fg">{repo.name}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-xs text-muted" title={new Date(repo.updated_at).toLocaleString()}>
                {zipping === repo.id
                  ? 'Zipping…'
                  : `${repo.file_count} files · ${formatBytes(repo.size)} · ${timeAgo(repo.updated_at)}`}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <IconBtn
                  title="Download as .zip"
                  disabled={zipping !== null}
                  onClick={(e) => stop(e, () => void download(repo))}
                >
                  <Download className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn title="Update (paste a new version)" onClick={(e) => stop(e, () => setTarget(repo))}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn
                  title="Delete"
                  onClick={(e) =>
                    stop(e, async () => {
                      const ok = await dlg.confirm({
                        title: `Delete "${repo.name}"?`,
                        message: `All ${repo.file_count} files are removed.`,
                        confirmText: 'Delete',
                        danger: true,
                      })
                      if (ok) void remove(repo)
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ImportStatus({ state, onCancel, onDismiss }: { state: ImportState; onCancel: () => void; onDismiss: () => void }) {
  if (state.phase === 'idle') return null
  const box = 'mx-3 mb-2 rounded-lg border border-border bg-elevated p-3 text-xs'

  if (state.phase === 'detecting')
    return (
      <div className={`${box} flex items-center gap-2 text-muted`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading files…
      </div>
    )

  if (state.phase === 'importing')
    return (
      <div className={box}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate text-fg">Importing {state.name}</span>
          <button type="button" onClick={onCancel} className="text-muted hover:text-fg">
            Cancel
          </button>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(state.done / state.total) * 100}%` }} />
        </div>
        <p className="mt-1 text-muted">
          {state.done} / {state.total} files
        </p>
      </div>
    )

  const failed = state.phase === 'error' ? state.details : state.report.failed
  return (
    <div className={box}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className={`font-medium ${state.phase === 'done' ? 'text-emerald-400' : state.phase === 'partial' ? 'text-amber-300' : 'text-red-400'}`}>
          {state.phase === 'done'
            ? 'Repository imported!'
            : state.phase === 'partial'
              ? state.report.cancelled
                ? 'Import cancelled — paste again to resume'
                : 'Imported with issues'
              : 'Import failed'}
        </span>
        <button type="button" onClick={onDismiss} title="Dismiss" className="text-muted hover:text-fg">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {state.phase === 'error' ? (
        <p className="text-muted">{state.message}</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-muted">
          <dt>Name</dt>
          <dd className="truncate text-fg">{state.report.name}</dd>
          <dt>Files</dt>
          <dd className="text-fg">{state.report.files}</dd>
          <dt>Folders</dt>
          <dd className="text-fg">{state.report.dirs}</dd>
          <dt>Size</dt>
          <dd className="text-fg">{formatBytes(state.report.size)}</dd>
          <dt>Date</dt>
          <dd className="text-fg">{new Date(state.report.at).toLocaleString()}</dd>
          <dt>Changes</dt>
          <dd className="text-fg">
            {state.report.uploaded} saved · {state.report.unchanged} unchanged · {state.report.removed} removed
          </dd>
        </dl>
      )}
      {failed.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-amber-300">{failed.length} not imported</summary>
          <ul className="mt-1 max-h-32 overflow-y-auto font-mono text-[10px] text-muted">
            {failed.map((f, i) => (
              <li key={i} className="truncate" title={`${f.path}: ${f.reason}`}>
                {f.path} — {f.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function stop(e: React.MouseEvent, fn: () => void) {
  e.stopPropagation()
  fn()
}

function IconBtn({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className="rounded p-1 text-muted hover:bg-surface hover:text-fg">
      {children}
    </button>
  )
}
