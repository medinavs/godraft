import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  Download,
  File as FileIcon,
  Folder as FolderIcon,
  FolderPlus,
  Link2,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react'
import { useFiles } from './useFiles'
import { downloadUrl, isImage, publicUrl } from './filesService'
import type { FileItem, Folder } from './types'

const DRAG_TYPE = 'text/godraft-file'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function FilesPanel({ workspace }: { workspace: string }) {
  const { files, folders, uploads, upload, remove, moveFile, createFolder, renameFolder, deleteFolder } =
    useFiles(workspace)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)

  useEffect(() => {
    if (folderId && !folders.some((f) => f.id === folderId)) setFolderId(null)
  }, [folders, folderId])

  const visibleFiles = files.filter((f) => f.folder_id === folderId)
  const countIn = (id: string) => files.filter((f) => f.folder_id === id).length
  const empty = visibleFiles.length === 0 && uploads.length === 0 && (folderId !== null || folders.length === 0)

  const copyLink = async (item: FileItem) => {
    await navigator.clipboard.writeText(publicUrl(item.path))
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const newFolder = () => {
    const name = prompt('Folder name')?.trim()
    if (name) void createFolder(name)
  }

  const dropInto = (target: string | null) => (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    if (e.dataTransfer.files.length) void upload(e.dataTransfer.files, target)
    else {
      const id = e.dataTransfer.getData(DRAG_TYPE)
      if (id) void moveFile(id, target)
    }
  }

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${dragging ? 'bg-primary/10' : ''}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return // ignore internal tile drags
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={dropInto(folderId)}
    >
      <div className="flex items-center justify-between px-3 pb-2">
        <span className="truncate text-xs text-muted">
          {folderId ? `${visibleFiles.length} in folder` : `${files.length} file${files.length === 1 ? '' : 's'}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={newFolder}
            title="New folder"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-elevated hover:text-fg"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-elevated hover:text-fg"
          >
            <Upload className="h-3.5 w-3.5" /> Upload
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files, folderId)
            e.target.value = ''
          }}
        />
      </div>

      {folderId && (
        <button
          type="button"
          onClick={() => setFolderId(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={dropInto(null)}
          className="mx-3 mb-2 flex items-center gap-1 rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-elevated hover:text-fg"
          title="Back to all files (drop here to move out)"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {folders.find((f) => f.id === folderId)?.name ?? 'Folder'}
        </button>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {empty ? (
          <p className="px-2 py-3 text-center text-xs text-muted">Drop files here to share.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {folderId === null &&
              folders.map((folder) => (
                <FolderTile
                  key={folder.id}
                  folder={folder}
                  count={countIn(folder.id)}
                  onOpen={() => setFolderId(folder.id)}
                  onRename={() => {
                    const name = prompt('Rename folder', folder.name)?.trim()
                    if (name) void renameFolder(folder.id, name)
                  }}
                  onDelete={() => {
                    if (confirm(`Delete folder "${folder.name}"? Files move back to All files.`))
                      void deleteFolder(folder.id)
                  }}
                  onDropInto={dropInto(folder.id)}
                />
              ))}

            {uploads.map((u) => (
              <div key={u.id}>
                <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-border bg-elevated p-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.round(u.progress * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted">{Math.round(u.progress * 100)}%</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted" title={u.name}>
                  {u.name}
                </p>
              </div>
            ))}

            {visibleFiles.map((f) => (
              <div
                key={f.id}
                className="group"
                draggable
                onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, f.id)}
              >
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border bg-elevated">
                  {isImage(f.name) ? (
                    <a href={publicUrl(f.path)} target="_blank" rel="noreferrer" draggable={false}>
                      <img
                        src={publicUrl(f.path)}
                        alt={f.name}
                        loading="lazy"
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ) : (
                    <FileIcon className="h-8 w-8 text-muted" />
                  )}

                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <IconBtn title={copiedId === f.id ? 'Copied link' : 'Copy link'} onClick={() => copyLink(f)}>
                      <Link2 className={`h-3.5 w-3.5 ${copiedId === f.id ? 'text-emerald-400' : ''}`} />
                    </IconBtn>
                    <a
                      title="Download"
                      href={downloadUrl(f.path, f.name)}
                      className="rounded p-1 text-white/80 hover:bg-white/20 hover:text-white"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <IconBtn title="Delete" onClick={() => remove(f)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                </div>
                <p className="mt-1 truncate text-xs text-fg" title={f.name}>
                  {f.name}
                </p>
                <p className="text-[10px] text-muted">{formatBytes(f.size)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FolderTile({
  folder,
  count,
  onOpen,
  onRename,
  onDelete,
  onDropInto,
}: {
  folder: Folder
  count: number
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
  onDropInto: (e: React.DragEvent) => void
}) {
  const [over, setOver] = useState(false)
  return (
    <div className="group">
      <button
        type="button"
        onClick={onOpen}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          setOver(false)
          onDropInto(e)
        }}
        className={`relative flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border bg-elevated transition-colors ${
          over ? 'border-primary bg-primary/10' : 'border-border'
        }`}
      >
        <FolderIcon className="h-8 w-8 text-primary" />
        <span className="text-[10px] text-muted">{count} file{count === 1 ? '' : 's'}</span>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
          <IconBtn title="Rename" onClick={(e) => stop(e, onRename)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn title="Delete folder" onClick={(e) => stop(e, onDelete)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </button>
      <p className="mt-1 truncate text-xs text-fg" title={folder.name}>
        {folder.name}
      </p>
    </div>
  )
}

function stop(e: React.MouseEvent, fn: () => void) {
  e.stopPropagation()
  fn()
}

function IconBtn({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className="rounded p-1 text-white/80 hover:bg-white/20 hover:text-white">
      {children}
    </button>
  )
}
