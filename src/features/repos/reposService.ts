import { supabase } from '@/shared/lib/supabase'
import { publicUrl } from '@/features/files/filesService'
import { downloadZip, type ZipEntry } from '@/shared/lib/zip'
import type { Incoming } from './clipboard'
import { countDirs, decodeText, INLINE_TEXT_MAX, pool, sha256, type Rejected } from './repoTree'

const BUCKET = 'files'
const FILE_COLS = 'id,path,size,hash,binary,storage_path'
const CONCURRENCY = 6
const BATCH_ROWS = 200
const BATCH_BYTES = 2 * 1024 * 1024

export interface Repo {
  id: string
  workspace: string
  name: string
  file_count: number
  dir_count: number
  size: number
  created_at: string
  updated_at: string
}

/** File metadata only — content is fetched on demand. */
export interface RepoFile {
  id: string
  path: string
  size: number
  hash: string
  binary: boolean
  storage_path: string | null
}

export interface ImportReport {
  name: string
  files: number
  dirs: number
  size: number
  at: string
  uploaded: number
  unchanged: number
  removed: number
  failed: Rejected[]
  cancelled: boolean
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

function chunks<T>(items: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n))
  return out
}

export async function fetchRepos(workspace: string): Promise<Repo[]> {
  const { data, error } = await supabase
    .from('repos')
    .select('*')
    .eq('workspace', workspace)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as Repo[]
}

export async function fetchRepoFiles(repoId: string): Promise<RepoFile[]> {
  const out: RepoFile[] = []
  for (;;) {
    // paged: PostgREST caps rows per request
    const { data, error } = await supabase
      .from('repo_files')
      .select(FILE_COLS)
      .eq('repo_id', repoId)
      .order('path')
      .range(out.length, out.length + 999)
    if (error) throw error
    if (!data.length) return out
    out.push(...(data as RepoFile[]))
  }
}

/** Text of a non-binary file: inline row content, or the storage blob for big files. */
export async function fetchContent(file: RepoFile): Promise<string> {
  if (file.storage_path) {
    const res = await fetch(publicUrl(file.storage_path))
    if (!res.ok) throw new Error(`Failed to load ${file.path}`)
    return res.text()
  }
  const { data, error } = await supabase.from('repo_files').select('content').eq('id', file.id).single()
  if (error) throw error
  return (data.content as string | null) ?? ''
}

/** Server-side substring search over inline text; returns matching file ids. */
export async function searchContent(repoId: string, q: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('repo_files')
    .select('id')
    .eq('repo_id', repoId)
    .ilike('content', `%${q.replace(/[\\%_]/g, '\\$&')}%`)
    .limit(200)
  if (error) throw error
  return data.map((r) => r.id as string)
}

/** Downloads the repo as <name>.zip with its folder structure. Inline text is paged in, blobs fetched by url. */
export async function exportRepo(repo: Repo): Promise<void> {
  const entries: ZipEntry[] = []
  for (;;) {
    // small pages: rows carry full file content
    const { data, error } = await supabase
      .from('repo_files')
      .select('path,content,storage_path')
      .eq('repo_id', repo.id)
      .order('path')
      .range(entries.length, entries.length + 199)
    if (error) throw error
    if (!data.length) break
    for (const f of data)
      entries.push(f.storage_path ? { name: f.path, url: publicUrl(f.storage_path) } : { name: f.path, text: f.content ?? '' })
  }
  await downloadZip(repo.name, entries)
}

async function removeBlobs(paths: string[]) {
  for (const c of chunks(paths, 100)) await supabase.storage.from(BUCKET).remove(c)
}

export async function deleteRepo(repo: Repo): Promise<void> {
  const files = await fetchRepoFiles(repo.id)
  await removeBlobs([...new Set(files.flatMap((f) => (f.storage_path ? [f.storage_path] : [])))])
  const { error } = await supabase.from('repos').delete().eq('id', repo.id) // repo_files cascade
  if (error) throw error
}

type Row = Omit<RepoFile, 'id'> & { repo_id: string; content: string | null }

/**
 * Streams files into a new or existing repo. Files are read CONCURRENCY at a time and
 * flushed in small batches, so memory stays bounded. On re-import, files whose path+hash
 * already exist are skipped and paths missing from the new version are removed — which
 * also makes re-running a cancelled/partial import cheap.
 */
export async function importRepo(opts: {
  workspace: string
  name: string
  target: Repo | null
  files: Incoming[]
  signal: AbortSignal
  onProgress: (done: number, total: number) => void
}): Promise<{ repo: Repo; report: ImportReport }> {
  const { workspace, name, target, files, signal, onProgress } = opts

  let repo = target
  if (!repo) {
    const { data, error } = await supabase.from('repos').insert({ workspace, name }).select().single()
    if (error) throw error
    repo = data as Repo
  }
  const repoId = repo.id

  const existing = target ? await fetchRepoFiles(repoId) : []
  const prev = new Map(existing.map((f) => [f.path, f]))
  const final = new Map<string, Pick<RepoFile, 'size' | 'storage_path'>>(prev)
  const failed: Rejected[] = []
  let done = 0
  let uploaded = 0
  let unchanged = 0
  let batch: Row[] = []
  let batchBytes = 0

  const flush = async () => {
    if (!batch.length) return
    const rows = batch
    batch = []
    batchBytes = 0
    const { error } = await supabase.from('repo_files').upsert(rows, { onConflict: 'repo_id,path' })
    if (error) rows.forEach((r) => failed.push({ path: r.path, reason: error.message }))
    else {
      uploaded += rows.length
      rows.forEach((r) => final.set(r.path, r))
    }
  }

  await pool(
    files,
    CONCURRENCY,
    async ({ path, file }) => {
      try {
        const buf = new Uint8Array(await file.arrayBuffer())
        const hash = await sha256(buf)
        if (prev.get(path)?.hash === hash) {
          unchanged++
          return
        }
        const text = decodeText(buf)
        const inline = text !== null && buf.length <= INLINE_TEXT_MAX
        let storage_path: string | null = null
        if (!inline) {
          // content-addressed, served as inert bytes so nothing imported can run from the bucket
          storage_path = `${workspace}/repos/${repoId}/${hash}`
          const contentType =
            text !== null
              ? 'text/plain; charset=utf-8'
              : /^image\/(?!svg)/.test(file.type)
                ? file.type
                : 'application/octet-stream'
          const { error } = await supabase.storage.from(BUCKET).upload(storage_path, buf, { upsert: true, contentType })
          if (error) throw error
        }
        batch.push({ repo_id: repoId, path, size: buf.length, hash, binary: text === null, content: inline ? text : null, storage_path })
        batchBytes += inline ? buf.length : 256
        if (batch.length >= BATCH_ROWS || batchBytes >= BATCH_BYTES) await flush()
      } catch (e) {
        failed.push({ path, reason: errMsg(e) })
      } finally {
        onProgress(++done, files.length)
      }
    },
    signal,
  )
  await flush()

  let removed = 0
  if (!signal.aborted) {
    const incoming = new Set(files.map((f) => f.path))
    const gone = existing.filter((f) => !incoming.has(f.path))
    for (const c of chunks(gone, 200)) {
      const { error } = await supabase.from('repo_files').delete().in('id', c.map((f) => f.id))
      if (error) throw error
    }
    gone.forEach((f) => final.delete(f.path))
    removed = gone.length
  }
  const live = new Set([...final.values()].map((f) => f.storage_path))
  await removeBlobs([...new Set(existing.flatMap((f) => (f.storage_path && !live.has(f.storage_path) ? [f.storage_path] : [])))])

  if (!target && final.size === 0) {
    await deleteRepo(repo)
    throw new Error(failed[0] ? `Nothing was imported: ${failed[0].reason}` : 'Nothing was imported.')
  }

  const stats = {
    file_count: final.size,
    dir_count: countDirs(final.keys()),
    size: [...final.values()].reduce((n, f) => n + f.size, 0),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('repos').update(stats).eq('id', repoId).select().single()
  if (error) throw error

  return {
    repo: data as Repo,
    report: {
      name: repo.name,
      files: stats.file_count,
      dirs: stats.dir_count,
      size: stats.size,
      at: stats.updated_at,
      uploaded,
      unchanged,
      removed,
      failed,
      cancelled: signal.aborted,
    },
  }
}
