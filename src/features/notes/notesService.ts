import { supabase } from '@/shared/lib/supabase'
import type { Note, NotePatch } from './types'

const TABLE = 'notes'

export async function fetchNotes(workspace: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('workspace', workspace)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as Note[]
}

export async function createNote(workspace: string, seed: Partial<Note> = {}): Promise<Note> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      workspace,
      title: seed.title ?? 'Untitled',
      content: seed.content ?? '',
      mode: seed.mode ?? 'text',
      language: seed.language ?? 'plaintext',
      pinned: seed.pinned ?? false,
      folder_id: seed.folder_id ?? null,
      updated_at: now,
    })
    .select()
    .single()
  if (error) throw error
  return data as Note
}

export async function updateNote(id: string, patch: NotePatch): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}
