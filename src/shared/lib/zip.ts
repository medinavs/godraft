import { strToU8, zip } from 'fflate'

export type ZipEntry = { name: string } & ({ url: string } | { text: string })

const CONCURRENCY = 6 // thousands of parallel fetches exhaust the browser and trip storage rate limits

/** Retries network errors, 429 and 5xx with exponential backoff. */
async function fetchBytes(url: string, name: string): Promise<Uint8Array> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url).catch(() => null)
    if (res?.ok) return new Uint8Array(await res.arrayBuffer())
    const retryable = !res || res.status === 429 || res.status >= 500
    if (!retryable || attempt === 5) throw new Error(`Failed to download ${name}${res ? ` (${res.status})` : ''}`)
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt))
  }
}

/** Zips remote files (url) and/or inline content (text) and saves it. Duplicate names get a (n) suffix. */
export async function downloadZip(
  zipName: string,
  entries: ZipEntry[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const files: Record<string, Uint8Array> = {}
  let next = 0
  let done = 0

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, entries.length) }, async () => {
      while (next < entries.length) {
        const entry = entries[next++]
        const data = 'text' in entry ? strToU8(entry.text) : await fetchBytes(entry.url, entry.name)
        files[uniqueName(files, entry.name)] = data
        onProgress?.(++done, entries.length)
      }
    }),
  )

  const blob = await new Promise<Blob>((resolve, reject) =>
    zip(files, { level: 6 }, (err, data) =>
      err ? reject(err) : resolve(new Blob([data], { type: 'application/zip' })),
    ),
  )

  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = zipName.replace(/[^\w.-]+/g, '_') + '.zip'
  a.click()
  setTimeout(() => URL.revokeObjectURL(href), 10_000) // Safari aborts if revoked too early
}

export function uniqueName(taken: Record<string, unknown>, name: string): string {
  if (!(name in taken)) return name
  const dot = name.lastIndexOf('.')
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
  let i = 2
  while (`${base} (${i})${ext}` in taken) i++
  return `${base} (${i})${ext}`
}
