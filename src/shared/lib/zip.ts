import { strToU8, zip } from 'fflate'

export type ZipEntry = { name: string } & ({ url: string } | { text: string })

/** Zips remote files (url) and/or inline content (text) and saves it. Duplicate names get a (n) suffix. */
export async function downloadZip(zipName: string, entries: ZipEntry[]): Promise<void> {
  const files: Record<string, Uint8Array> = {}

  await Promise.all(
    entries.map(async (entry) => {
      let data: Uint8Array
      if ('text' in entry) {
        data = strToU8(entry.text)
      } else {
        const res = await fetch(entry.url)
        if (!res.ok) throw new Error(`Failed to download ${entry.name}`)
        data = new Uint8Array(await res.arrayBuffer())
      }
      files[uniqueName(files, entry.name)] = data
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
