import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/shared/lib/supabase'
import type { FileItem } from './types'

const TABLE = 'files'
const BUCKET = 'files'
export const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25MB - keep uploads within free-tier sanity

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i
export const isImage = (name: string) => IMAGE_RE.test(name)

function xhrUpload(path: string, file: File, onProgress: (frac: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`)
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY)
    if (file.type) xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`))
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(file)
  })
}

export async function fetchFiles(workspace: string): Promise<FileItem[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('workspace', workspace)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as FileItem[]
}

export async function uploadFile(
  workspace: string,
  file: File,
  onProgress: (frac: number) => void = () => { },
): Promise<FileItem> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds 25MB`)
  const safe = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${workspace}/${crypto.randomUUID()}-${safe}`

  await xhrUpload(path, file, onProgress)

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ workspace, name: file.name, size: file.size, path })
    .select()
    .single()
  if (error) throw error
  return data as FileItem
}

export async function deleteFile(item: FileItem): Promise<void> {
  await supabase.storage.from(BUCKET).remove([item.path])
  const { error } = await supabase.from(TABLE).delete().eq('id', item.id)
  if (error) throw error
}

export function publicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export function downloadUrl(path: string, name: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path, { download: name }).data.publicUrl
}
