import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useFolders } from '@/features/folders/useFolders'
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
  const { folders, createFolder, renameFolder, deleteFolder: removeFolder } = useFolders(workspace, 'file')

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
            const i = prev.findIndex((f) => f.id === row.id)
            if (i === -1) return [row, ...prev]
            const next = [...prev]
            next[i] = row // apply updates (e.g. moved to another folder)
            return next
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
    async (list: FileList | File[], folderId: string | null = null) => {
      await Promise.all(
        Array.from(list).map(async (file) => {
          const id = crypto.randomUUID()
          setUploads((prev) => [...prev, { id, name: file.name, progress: 0 }])
          try {
            const item = await service.uploadFile(workspace, file, folderId, (progress) =>
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

  const moveFile = useCallback(async (id: string, folderId: string | null) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, folder_id: folderId } : f)))
    await service.moveFile(id, folderId).catch(console.error)
  }, [])

  const deleteFolder = useCallback(
    async (id: string) => {
      setFiles((prev) => prev.map((f) => (f.folder_id === id ? { ...f, folder_id: null } : f)))
      await removeFolder(id)
    },
    [removeFolder],
  )

  return { files, folders, uploads, upload, remove, moveFile, createFolder, renameFolder, deleteFolder }
}
