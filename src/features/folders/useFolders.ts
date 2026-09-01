import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import * as service from './foldersService'
import type { Folder, FolderKind } from './foldersService'

const byName = (a: Folder, b: Folder) => a.name.localeCompare(b.name)

export function useFolders(workspace: string, kind: FolderKind) {
  const [folders, setFolders] = useState<Folder[]>([])

  useEffect(() => {
    let alive = true
    service.fetchFolders(workspace, kind).then((f) => alive && setFolders(f)).catch(console.error)

    const channel = supabase
      .channel(`folders:${kind}:${workspace}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'folders', filter: `workspace=eq.${workspace}` },
        (payload) => {
          setFolders((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((f) => f.id !== (payload.old as Folder).id)
            }
            const row = payload.new as Folder
            if (row.kind !== kind) return prev // belongs to the other feature
            return [...prev.filter((f) => f.id !== row.id), row].sort(byName)
          })
        },
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [workspace, kind])

  const createFolder = useCallback(
    async (name: string) => {
      const folder = await service.createFolder(workspace, kind, name)
      setFolders((prev) => (prev.some((f) => f.id === folder.id) ? prev : [...prev, folder]).sort(byName))
      return folder
    },
    [workspace, kind],
  )

  const renameFolder = useCallback(async (id: string, name: string) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)).sort(byName))
    await service.renameFolder(id, name).catch(console.error)
  }, [])

  const deleteFolder = useCallback(async (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id))
    await service.deleteFolder(id).catch(console.error)
  }, [])

  return { folders, createFolder, renameFolder, deleteFolder }
}
