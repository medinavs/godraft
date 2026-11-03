// Pure repo-import logic (no DOM, no Supabase) — covered by repoTree.test.ts.

export const REPO_MAX_FILE_BYTES = 25 * 1024 * 1024
export const REPO_MAX_BYTES = 500 * 1024 * 1024
export const INLINE_TEXT_MAX = 1024 * 1024 // text up to this lives in Postgres (searchable); bigger goes to storage

export interface Rejected {
  path: string
  reason: string
}

/** Normalizes a received path to 'a/b/c'. Null for anything that could escape the repo or is garbage. */
export function sanitizePath(raw: string): string | null {
  const parts = raw
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p !== '' && p !== '.')
  // eslint-disable-next-line no-control-regex
  if (!parts.length || parts.some((p) => p === '..' || p.length > 255 || /[\x00-\x1f]/.test(p))) return null
  return parts.join('/')
}

/**
 * Validates paths, drops duplicates/oversized files and strips a shared top folder (the pasted repo itself).
 * `exclude` holds folder names skipped at any depth (e.g. '.git'); they're counted, not reported as failures.
 */
export function prepare<T extends { path: string; file: { size: number } }>(raw: T[], exclude: string[] = []) {
  const rejected: Rejected[] = []
  const seen = new Set<string>()
  let files: T[] = []
  let excluded = 0
  for (const r of raw) {
    const path = sanitizePath(r.path)
    if (!path) rejected.push({ path: r.path, reason: 'invalid path' })
    else if (path.split('/').slice(0, -1).some((d) => exclude.includes(d))) excluded++
    else if (seen.has(path)) rejected.push({ path, reason: 'duplicate path' })
    else if (r.file.size > REPO_MAX_FILE_BYTES)
      rejected.push({ path, reason: `larger than ${REPO_MAX_FILE_BYTES / 1024 / 1024} MB` })
    else {
      seen.add(path)
      files.push({ ...r, path })
    }
  }
  const first = files[0]?.path.split('/')[0]
  const root = first && files.every((f) => f.path.startsWith(first + '/')) ? first : null
  if (root) files = files.map((f) => ({ ...f, path: f.path.slice(root.length + 1) }))
  const bytes = files.reduce((n, f) => n + f.file.size, 0)
  return { root, files, rejected, bytes, excluded }
}

export interface TreeNode {
  name: string
  path: string
  children?: TreeNode[] // undefined = file
}

export interface Row {
  name: string
  path: string
  depth: number
  dir: boolean
}

export function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: '', path: '', children: [] }
  const dirs = new Map<string, TreeNode>([['', root]])
  for (const p of paths) {
    const parts = p.split('/')
    let parent = root
    for (let i = 0; i < parts.length - 1; i++) {
      const dp = parts.slice(0, i + 1).join('/')
      let d = dirs.get(dp)
      if (!d) {
        d = { name: parts[i], path: dp, children: [] }
        dirs.set(dp, d)
        parent.children!.push(d)
      }
      parent = d
    }
    parent.children!.push({ name: parts[parts.length - 1], path: p })
  }
  for (const d of dirs.values())
    d.children!.sort((a, b) => Number(!a.children) - Number(!b.children) || a.name.localeCompare(b.name))
  return root
}

/** Visible rows only: children of collapsed dirs are never visited. */
export function flatten(node: TreeNode, expanded: Set<string>, depth = 0, out: Row[] = []): Row[] {
  for (const c of node.children ?? []) {
    out.push({ name: c.name, path: c.path, depth, dir: !!c.children })
    if (c.children && expanded.has(c.path)) flatten(c, expanded, depth + 1, out)
  }
  return out
}

export function countDirs(paths: Iterable<string>): number {
  const dirs = new Set<string>()
  for (const p of paths) {
    for (let i = p.lastIndexOf('/'); i > 0; i = p.lastIndexOf('/', i - 1)) {
      const d = p.slice(0, i)
      if (dirs.has(d)) break // its ancestors are already in
      dirs.add(d)
    }
  }
  return dirs.size
}

/** UTF-8 text or null for binary. NUL bytes count as binary (Postgres text can't hold them anyway). */
export function decodeText(buf: Uint8Array): string | null {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buf)
    return text.includes('\0') ? null : text
  } catch {
    return null
  }
}

export async function sha256(buf: Uint8Array<ArrayBuffer>): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf))
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Runs fn over items with at most n in flight; stops picking new items once signal aborts. */
export async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>, signal?: AbortSignal) {
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length && !signal?.aborted) await fn(items[i++])
    }),
  )
}
