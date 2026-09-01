import { supabase } from '@/shared/lib/supabase'

export type FolderKind = 'file' | 'note'

export interface Folder {
  id: string
  workspace: string
  kind: FolderKind
  name: string
  created_at: string
}

const TABLE = 'folders'

export async function fetchFolders(workspace: string, kind: FolderKind): Promise<Folder[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('workspace', workspace)
    .eq('kind', kind)
    .order('name')
  if (error) throw error
  return data as Folder[]
}

export async function createFolder(workspace: string, kind: FolderKind, name: string): Promise<Folder> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ workspace, kind, name })
    .select()
    .single()
  if (error) throw error
  return data as Folder
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ name }).eq('id', id)
  if (error) throw error
}

export async function deleteFolder(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}
