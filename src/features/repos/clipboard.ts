import { unzip } from 'fflate'
import { REPO_MAX_BYTES, REPO_MAX_FILE_BYTES, type Rejected } from './repoTree'

export interface Incoming {
  path: string
  file: File
}

export const UNREADABLE = 'folder contents not exposed by the browser'

interface Grabbed {
  entry: FileSystemEntry | null
  file: File | null
}

/**
 * Collects files from a paste, drop or folder picker, keeping relative paths.
 * Call synchronously inside the event handler: DataTransfer items are emptied once the
 * handler returns, so entries are grabbed before the first await.
 *
 * Folders: drop and the picker always expose them (webkitGetAsEntry / webkitRelativePath).
 * Paste only does when the browser hands over entries; otherwise a pasted folder arrives as an
 * empty unreadable File and is reported as UNREADABLE instead of faking an import.
 */
export function collect(src: DataTransfer | FileList): Promise<{ files: Incoming[]; rejected: Rejected[] }> {
  let grabbed: Grabbed[]
  if ('items' in src) {
    const items = Array.from(src.items).filter((i) => i.kind === 'file')
    grabbed = items.length
      ? items.map((i) => ({ entry: i.webkitGetAsEntry?.() ?? null, file: i.getAsFile() }))
      : Array.from(src.files, (file) => ({ entry: null, file }))
  } else {
    grabbed = Array.from(src, (file) => ({ entry: null, file }))
  }
  return read(grabbed)
}

async function read(grabbed: Grabbed[]) {
  const files: Incoming[] = []
  const rejected: Rejected[] = []
  for (const { entry, file } of grabbed) {
    if (entry?.isDirectory) await walk(entry as FileSystemDirectoryEntry, files, rejected)
    else if (entry?.isFile) await pushEntry(entry as FileSystemFileEntry, files, rejected)
    else if (file) {
      if (!file.size && !(await readable(file))) rejected.push({ path: file.name, reason: UNREADABLE })
      else files.push({ path: file.webkitRelativePath || file.name, file })
    }
  }
  if (files.length === 1 && !rejected.length && /\.zip$/i.test(files[0].file.name)) return unzipFile(files[0].file)
  return { files, rejected }
}

const readable = (f: File) => f.slice(0, 1).arrayBuffer().then(() => true, () => false)

async function pushEntry(e: FileSystemFileEntry, out: Incoming[], rejected: Rejected[]) {
  try {
    out.push({ path: e.fullPath, file: await new Promise<File>((res, rej) => e.file(res, rej)) })
  } catch {
    rejected.push({ path: e.fullPath, reason: 'could not be read' })
  }
}

async function walk(dir: FileSystemDirectoryEntry, out: Incoming[], rejected: Rejected[]) {
  const reader = dir.createReader()
  for (;;) {
    // readEntries returns ~100 at a time; empty batch = done
    const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej))
    if (!batch.length) return
    await Promise.all(batch.filter((e) => e.isFile).map((e) => pushEntry(e as FileSystemFileEntry, out, rejected)))
    for (const e of batch) if (e.isDirectory) await walk(e as FileSystemDirectoryEntry, out, rejected)
  }
}

/** A pasted .zip is expanded — the most portable way to move a whole folder through a clipboard. */
async function unzipFile(zip: File) {
  const rejected: Rejected[] = []
  if (zip.size > REPO_MAX_BYTES) return { files: [], rejected: [{ path: zip.name, reason: 'zip too large' }] }
  let total = 0
  const data = new Uint8Array(await zip.arrayBuffer())
  const out = await new Promise<Record<string, Uint8Array>>((res, rej) =>
    unzip(
      data,
      {
        filter: (f) => {
          if (f.name.endsWith('/')) return false
          const ok = f.originalSize <= REPO_MAX_FILE_BYTES && (total += f.originalSize) <= REPO_MAX_BYTES
          if (!ok) rejected.push({ path: f.name, reason: 'exceeds size limit' })
          return ok
        },
      },
      (err, r) => (err ? rej(err) : res(r)),
    ),
  )
  const files = Object.entries(out).map(([path, d]) => ({ path, file: new File([d as Uint8Array<ArrayBuffer>], path.split('/').pop()!) }))
  return { files, rejected }
}
