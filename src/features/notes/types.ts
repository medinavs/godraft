export type EditorMode = 'text' | 'code'

export const LANGUAGES = [
  'plaintext',
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
  created_at: string
  updated_at: string
}

export type NotePatch = Partial<Pick<Note, 'title' | 'content' | 'mode' | 'language' | 'pinned'>>
