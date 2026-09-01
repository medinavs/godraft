export type EditorMode = 'text' | 'code'

export const LANGUAGES = [
  'plaintext',
  'markdown',
  'go',
  'typescript',
  'javascript',
  'json',
  'sql',
  'yaml',
  'bash',
] as const

export type Language = (typeof LANGUAGES)[number]

export interface Note {
  id: string
  workspace: string
  title: string
  content: string
  mode: EditorMode
  language: Language
  pinned: boolean
  folder_id: string | null // null = workspace root
  created_at: string
  updated_at: string
}

export type NotePatch = Partial<Pick<Note, 'title' | 'content' | 'mode' | 'language' | 'pinned' | 'folder_id'>>
