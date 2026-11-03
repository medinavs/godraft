import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Download, File as FileIcon, Folder as FolderIcon, FolderGit2, Loader2, Search } from 'lucide-react'
import { Input } from '@/shared/components/ui/input'
import { downloadUrl, isImage, publicUrl } from '@/features/files/filesService'
import { formatBytes } from '@/shared/lib/utils'
import type { Language } from '@/features/notes/types'
import { buildTree, flatten, type Row } from './repoTree'
import { fetchContent, fetchRepoFiles, searchContent, type Repo, type RepoFile } from './reposService'

const CodeArea = lazy(() => import('@/features/editor/CodeArea').then((m) => ({ default: m.CodeArea })))

const ROW_H = 28
const EXT: Record<string, Language> = {
  go: 'go',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  sql: 'sql',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  md: 'markdown',
  markdown: 'markdown',
}
const languageFor = (name: string): Language =>
  name.includes('.') ? (EXT[name.slice(name.lastIndexOf('.') + 1).toLowerCase()] ?? 'plaintext') : 'plaintext'

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function RepoExplorer({ repo }: { repo: Repo }) {
  const [files, setFiles] = useState<RepoFile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'name' | 'content'>('name')
  const [hits, setHits] = useState<string[] | null>(null) // content-search file ids
  const q = useDebounced(query.trim(), mode === 'content' ? 400 : 150)

  // refetch metadata when a new version lands (updated_at changes); content stays on the server
  useEffect(() => {
    let alive = true
    setError(null)
    fetchRepoFiles(repo.id)
      .then((f) => alive && setFiles(f))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [repo.id, repo.updated_at])

  useEffect(() => {
    setHits(null)
    if (mode !== 'content' || q.length < 2) return
    let alive = true
    searchContent(repo.id, q)
      .then((ids) => alive && setHits(ids))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [repo.id, mode, q])

  const byPath = useMemo(() => new Map((files ?? []).map((f) => [f.path, f])), [files])
  const tree = useMemo(() => buildTree((files ?? []).map((f) => f.path)), [files])

  const rows: Row[] = useMemo(() => {
    const asRows = (list: RepoFile[]) => list.map((f) => ({ name: f.path, path: f.path, depth: 0, dir: false }))
    if (!q) return flatten(tree, expanded)
    if (mode === 'name') {
      const lq = q.toLowerCase()
      return asRows((files ?? []).filter((f) => f.path.toLowerCase().includes(lq)))
    }
    const ids = new Set(hits ?? [])
    return asRows((files ?? []).filter((f) => ids.has(f.id)))
  }, [q, mode, tree, expanded, files, hits])

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (!next.delete(path)) next.add(path)
      return next
    })

  const file = selected ? byPath.get(selected) : undefined

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <FolderGit2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-medium">{repo.name}</span>
        <span className="text-xs text-muted">
          {repo.file_count} files · {repo.dir_count} folders · {formatBytes(repo.size)} · imported{' '}
          {new Date(repo.updated_at).toLocaleString()}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-72 shrink-0 flex-col border-r border-border">
          <div className="space-y-2 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={mode === 'name' ? 'Find file by name' : 'Search in file contents'}
                className="pl-8"
              />
            </div>
            <div className="flex gap-1">
              {(['name', 'content'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-md px-2 py-1 text-xs capitalize transition-colors ${
                    mode === m ? 'bg-elevated text-fg' : 'text-muted hover:text-fg'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <p className="px-3 text-xs text-red-400">{error}</p>
          ) : !files || (mode === 'content' && q.length >= 2 && !hits) ? (
            <p className="flex items-center gap-2 px-3 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </p>
          ) : q && !rows.length ? (
            <p className="px-3 text-xs text-muted">No matches{mode === 'content' ? ' (files over 1 MB are not searched)' : ''}.</p>
          ) : (
            <VirtualList
              count={rows.length}
              render={(i) => {
                const r = rows[i]
                return (
                  <button
                    type="button"
                    onClick={() => (r.dir ? toggle(r.path) : setSelected(r.path))}
                    title={r.path}
                    style={{ paddingLeft: 8 + r.depth * 12 }}
                    className={`flex h-full w-full items-center gap-1.5 pr-2 text-left text-sm ${
                      r.path === selected ? 'bg-elevated text-fg' : 'text-muted hover:bg-elevated/60 hover:text-fg'
                    }`}
                  >
                    {r.dir ? (
                      <>
                        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded.has(r.path) ? 'rotate-90' : ''}`} />
                        <FolderIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      </>
                    ) : (
                      <FileIcon className="ml-5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="truncate">{r.name}</span>
                  </button>
                )
              }}
            />
          )}
        </div>

        <main className="flex min-w-0 flex-1 flex-col">
          {file ? (
            <FileView key={file.id + file.hash} file={file} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">Select a file</div>
          )}
        </main>
      </div>
    </div>
  )
}

/** Fixed-height rows; only what's on screen (plus overscan) is mounted. */
function VirtualList({ count, render }: { count: number; render: (i: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(0)
  const [height, setHeight] = useState(600)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const start = Math.max(0, Math.floor(top / ROW_H) - 10)
  const end = Math.min(count, Math.ceil((top + height) / ROW_H) + 10)
  const items = []
  for (let i = start; i < end; i++)
    items.push(
      <div key={i} className="absolute inset-x-0" style={{ top: i * ROW_H, height: ROW_H }}>
        {render(i)}
      </div>,
    )

  return (
    <div ref={ref} onScroll={(e) => setTop(e.currentTarget.scrollTop)} className="min-h-0 flex-1 overflow-y-auto pb-3">
      <div className="relative" style={{ height: count * ROW_H }}>
        {items}
      </div>
    </div>
  )
}

function FileView({ file }: { file: RepoFile }) {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const name = file.path.slice(file.path.lastIndexOf('/') + 1)

  useEffect(() => {
    if (file.binary) return
    let alive = true
    fetchContent(file)
      .then((t) => alive && setText(t))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [file])

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="flex-1 truncate font-mono text-xs text-fg">{file.path}</span>
        <span className="text-xs text-muted">{formatBytes(file.size)}</span>
        {file.storage_path && (
          <a href={downloadUrl(file.storage_path, name)} title="Download" className="text-muted hover:text-fg">
            <Download className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {file.binary ? (
          file.storage_path && isImage(name) ? (
            <img src={publicUrl(file.storage_path)} alt={name} className="m-4 max-w-full" />
          ) : (
            <p className="p-4 text-sm text-muted">Binary file — not previewed.</p>
          )
        ) : error ? (
          <p className="p-4 text-sm text-red-400">{error}</p>
        ) : text === null ? (
          <p className="flex items-center gap-2 p-4 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : (
          // shown as text only: imported HTML/JS/markdown is never rendered or executed
          <Suspense fallback={null}>
            <CodeArea value={text} language={languageFor(name)} readOnly />
          </Suspense>
        )}
      </div>
    </>
  )
}
