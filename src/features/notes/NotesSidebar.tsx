import { forwardRef, useEffect, useState, type ReactNode } from 'react'
import {
  ChevronLeft,
  Copy,
  Download,
  Folder as FolderIcon,
  FolderPlus,
  LogOut,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { useDialog } from '@/shared/components/ui/dialog'
import { useFolders } from '@/features/folders/useFolders'
import { timeAgo } from '@/shared/lib/utils'
import { downloadZip } from '@/shared/lib/zip'
import type { Note } from './types'

const DRAG_TYPE = 'text/godraft-note'

export type SidebarTab = 'notes' | 'files' | 'repos'

interface Props {
  workspace: string
  workspaceName: string
  notes: Note[]
  activeId: string | null
  query: string
  onQuery: (q: string) => void
  onSelect: (id: string) => void
  onCreate: (folderId?: string | null) => void
  onDelete: (id: string) => void
  onDuplicate: (note: Note) => void
  onTogglePin: (note: Note) => void
  onMoveNote: (id: string, folderId: string | null) => void
  onLeave: () => void
  tab: SidebarTab
  onTab: (tab: SidebarTab) => void
  filesTab?: ReactNode
  reposTab?: ReactNode
}

export const NotesSidebar = forwardRef<HTMLInputElement, Props>(function NotesSidebar(
  {
    workspace,
    workspaceName,
    notes,
    activeId,
    query,
    onQuery,
    onSelect,
    onCreate,
    onDelete,
    onDuplicate,
    onTogglePin,
    onMoveNote,
    onLeave,
    tab,
    onTab,
    filesTab,
    reposTab,
  },
  searchRef,
) {
  const dlg = useDialog()
  const { folders, createFolder, renameFolder, deleteFolder } = useFolders(workspace, 'note')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [zipping, setZipping] = useState<string | null>(null)

  useEffect(() => {
    if (folderId && !folders.some((f) => f.id === folderId)) setFolderId(null)
  }, [folders, folderId])

  const searching = query.trim() !== ''
  const showFolders = !searching && folderId === null
  const shownNotes = searching ? notes : notes.filter((n) => n.folder_id === folderId)
  const countIn = (id: string) => notes.filter((n) => n.folder_id === id).length

  const newFolder = async () => {
    const name = (await dlg.prompt({ title: 'New folder', placeholder: 'Folder name', confirmText: 'Create' }))?.trim()
    if (name) void createFolder(name)
  }

  const zipFolder = async (id: string | null) => {
    const items = notes.filter((n) => n.folder_id === id)
    if (!items.length) return
    const name = id ? (folders.find((f) => f.id === id)?.name ?? 'folder') : 'all-notes'
    setZipping(id ?? 'root')
    try {
      await downloadZip(
        name,
        items.map((n) => ({ name: `${(n.title.trim() || 'untitled').replace(/[\\/:*?"<>|]+/g, '-')}.md`, text: n.content })),
      )
    } catch (err) {
      await dlg.confirm({ title: 'Download failed', message: (err as Error).message, confirmText: 'OK' })
    } finally {
      setZipping(null)
    }
  }
  const dropNote = (target: string | null) => (e: React.DragEvent) => {
    e.preventDefault()
    setDropTarget(null)
    const id = e.dataTransfer.getData(DRAG_TYPE)
    if (id) onMoveNote(id, target)
  }

  return (
    <aside className="flex h-full w-72 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" title="live" />
        <span className="flex-1 truncate font-mono text-sm text-muted">{workspaceName}</span>
        <button
          type="button"
          onClick={onLeave}
          title="Leave workspace"
          className="rounded p-1 text-muted hover:bg-elevated hover:text-fg"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1 px-3 pb-2">
        {(['notes', 'files', 'repos'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTab(t)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-elevated text-fg' : 'text-muted hover:text-fg'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'notes' ? (
        <>
          <div className="flex items-center gap-1 px-3 pb-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Search  (Ctrl+K)"
                className="pl-8"
              />
            </div>
            {!searching && shownNotes.length > 0 && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => void zipFolder(folderId)}
                disabled={zipping !== null}
                title={folderId ? 'Download folder as .zip' : 'Download all notes as .zip'}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={newFolder} title="New folder">
              <FolderPlus className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onCreate(folderId)} title="New note (Ctrl+N)">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {folderId && !searching && (
            <button
              type="button"
              onClick={() => setFolderId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={dropNote(null)}
              title="Back to all notes (drop here to move out)"
              className="mx-3 mb-2 flex items-center gap-1 rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-elevated hover:text-fg"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {folders.find((f) => f.id === folderId)?.name ?? 'Folder'}
            </button>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {showFolders &&
              folders.map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => setFolderId(folder.id)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDropTarget(folder.id)
                  }}
                  onDragLeave={() => setDropTarget((t) => (t === folder.id ? null : t))}
                  onDrop={dropNote(folder.id)}
                  className={`group mb-1 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                    dropTarget === folder.id ? 'bg-primary/15 ring-1 ring-primary' : 'hover:bg-elevated/60'
                  }`}
                >
                  <FolderIcon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="flex-1 truncate text-sm font-medium text-fg">{folder.name}</span>
                  <span className="text-xs text-muted group-hover:hidden">
                    {zipping === folder.id ? '…' : countIn(folder.id)}
                  </span>
                  <div className="hidden items-center gap-0.5 group-hover:flex">
                    {countIn(folder.id) > 0 && (
                      <IconBtn title="Download as .zip" onClick={(e) => stop(e, () => void zipFolder(folder.id))}>
                        <Download className="h-3.5 w-3.5" />
                      </IconBtn>
                    )}
                    <IconBtn
                      title="Rename"
                      onClick={(e) =>
                        stop(e, async () => {
                          const name = (
                            await dlg.prompt({ title: 'Rename folder', defaultValue: folder.name, confirmText: 'Rename' })
                          )?.trim()
                          if (name) void renameFolder(folder.id, name)
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn
                      title="Delete folder"
                      onClick={(e) =>
                        stop(e, async () => {
                          const ok = await dlg.confirm({
                            title: `Delete "${folder.name}"?`,
                            message: 'Notes inside move back to All notes.',
                            confirmText: 'Delete',
                            danger: true,
                          })
                          if (!ok) return
                          notes.filter((n) => n.folder_id === folder.id).forEach((n) => onMoveNote(n.id, null))
                          void deleteFolder(folder.id)
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                </div>
              ))}

            {shownNotes.length === 0 && !showFolders && (
              <p className="px-3 py-6 text-center text-sm text-muted">No notes here.</p>
            )}

            {shownNotes.map((note) => (
              <div
                key={note.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, note.id)}
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
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">{tab === 'files' ? filesTab : reposTab}</div>
      )}
    </aside>
  )
})

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
