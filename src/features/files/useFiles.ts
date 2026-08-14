import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import * as service from './filesService'
import type { FileItem } from './types'

export interface Upload {
  id: string
  name: string
  progress: number // 0..1
}

export function useFiles(workspace: string) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [uploads, setUploads] = useState<Upload[]>([])

  useEffect(() => {
    let alive = true
    service.fetchFiles(workspace).then((f) => alive && setFiles(f)).catch(console.error)

    const channel = supabase
      .channel(`files:${workspace}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'files', filter: `workspace=eq.${workspace}` },
        (payload) => {
          setFiles((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((f) => f.id !== (payload.old as FileItem).id)
            }
            const row = payload.new as FileItem
            if (prev.some((f) => f.id === row.id)) return prev
            return [row, ...prev]
          })
        },
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [workspace])

  const upload = useCallback(
    async (list: FileList | File[]) => {
      await Promise.all(
        Array.from(list).map(async (file) => {
          const id = crypto.randomUUID()
          setUploads((prev) => [...prev, { id, name: file.name, progress: 0 }])
          try {
            const item = await service.uploadFile(workspace, file, (progress) =>
              setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, progress } : u))),
            )
            setFiles((prev) => (prev.some((f) => f.id === item.id) ? prev : [item, ...prev]))
          } catch (err) {
            console.error(err)
            alert(err instanceof Error ? err.message : 'Upload failed')
          } finally {
            setUploads((prev) => prev.filter((u) => u.id !== id))
          }
        }),
      )
    },
    [workspace],
  )

  const remove = useCallback(async (item: FileItem) => {
    setFiles((prev) => prev.filter((f) => f.id !== item.id))
    await service.deleteFile(item).catch(console.error)
  }, [])

  return { files, uploads, upload, remove }
}
