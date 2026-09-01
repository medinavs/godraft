import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import * as service from './notesService'
import type { Note, NotePatch } from './types'

export function useNotes(workspace: string) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    service
      .fetchNotes(workspace)
      .then((n) => alive && setNotes(n))
      .catch(console.error)
      .finally(() => alive && setLoading(false))

    const channel = supabase
      .channel(`notes:${workspace}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `workspace=eq.${workspace}` },
        (payload) => {
          setNotes((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((n) => n.id !== (payload.old as Note).id)
            }
            const row = payload.new as Note
            const i = prev.findIndex((n) => n.id === row.id)
            if (i === -1) return [row, ...prev]
            if (new Date(row.updated_at) < new Date(prev[i].updated_at)) return prev
            const next = [...prev]
            next[i] = row
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

  const patchLocal = useCallback((id: string, patch: NotePatch) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n)),
    )
  }, [])

  const create = useCallback(
    async (seed?: Partial<Note>) => {
      const note = await service.createNote(workspace, seed)
      setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)])
      return note
    },
    [workspace],
  )

  const update = useCallback(
    async (id: string, patch: NotePatch) => {
      patchLocal(id, patch) // optimistic
      await service.updateNote(id, patch)
    },
    [patchLocal],
  )

  const remove = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    await service.deleteNote(id)
  }, [])

  const duplicate = useCallback(
    (note: Note) =>
      create({
        title: `${note.title} copy`,
        content: note.content,
        mode: note.mode,
        language: note.language,
        folder_id: note.folder_id,
      }),
    [create],
  )

  const sorted = useMemo(
    () =>
      [...notes].sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [notes],
  )

  return { notes: sorted, loading, create, update, remove, duplicate }
}
