export interface FileItem {
  id: string
  workspace: string
  name: string
  size: number
  path: string // storage object path
  folder_id: string | null // null = workspace root
  created_at: string
}

export interface Folder {
  id: string
  workspace: string
  name: string
  created_at: string
}
