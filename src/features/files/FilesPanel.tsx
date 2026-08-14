import { useRef, useState } from 'react'
import { Download, File as FileIcon, Link2, Paperclip, Trash2, Upload } from 'lucide-react'
import { useFiles } from './useFiles'
import { isImage, publicUrl } from './filesService'
import type { FileItem } from './types'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function FilesPanel({ workspace }: { workspace: string }) {
  const { files, uploads, upload, remove } = useFiles(workspace)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyLink = async (item: FileItem) => {
    await navigator.clipboard.writeText(publicUrl(item.path))
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div
      className={`flex max-h-72 flex-col border-t border-border ${dragging ? 'bg-primary/10' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files.length) void upload(e.dataTransfer.files)
      }}
    >
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Paperclip className="h-4 w-4" />
          Files
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-elevated hover:text-fg"
        >
          <Upload className="h-3.5 w-3.5" /> Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {files.length === 0 && uploads.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted">Drop files here to share.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
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

            {files.map((f) => (
              <div key={f.id} className="group">
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border bg-elevated">
                  {isImage(f.name) ? (
                    <a href={publicUrl(f.path)} target="_blank" rel="noreferrer">
                      <img
                        src={publicUrl(f.path)}
                        alt={f.name}
                        loading="lazy"
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
                      href={publicUrl(f.path)}
                      download={f.name}
                      target="_blank"
                      rel="noreferrer"
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

function IconBtn({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className="rounded p-1 text-white/80 hover:bg-white/20 hover:text-white">
      {children}
    </button>
  )
}
