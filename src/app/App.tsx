import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, LogOut } from 'lucide-react'
import { supabaseConfigured } from '@/shared/lib/supabase'
import { Button } from '@/shared/components/ui/button'
import { useWorkspace } from '@/features/workspace/useWorkspace'
import { SecretGate } from '@/features/workspace/SecretGate'
import { useNotes } from '@/features/notes/useNotes'
import { NotesSidebar } from '@/features/notes/NotesSidebar'
import { EditorPane } from '@/features/editor/EditorPane'
import { FilesPanel } from '@/features/files/FilesPanel'

export default function App() {
  const { workspace, ready, enter, leave } = useWorkspace()

  if (!ready) return null
  if (!workspace) return <SecretGate onEnter={enter} />
  return <Workspace key={workspace.key} name={workspace.name} wkey={workspace.key} onLeave={leave} />
}

function Workspace({ name, wkey, onLeave }: { name: string; wkey: string; onLeave: () => void }) {
  const { notes, loading, create, update, remove, duplicate } = useNotes(wkey)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notes
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
    )
  }, [notes, query])

  useEffect(() => {
    if (activeId && notes.some((n) => n.id === activeId)) return
    setActiveId(notes[0]?.id ?? null)
  }, [notes, activeId])

  const active = notes.find((n) => n.id === activeId) ?? null

  const newNote = async () => {
    const note = await create()
    setActiveId(note.id)
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        void newNote()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-full flex-col">
      {!supabaseConfigured && (
        <div className="bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-300">
          Supabase is not configured — copy <code>.env.example</code> to <code>.env</code> and add your
          project URL and anon key.
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <NotesSidebar
          ref={searchRef}
          workspaceName={name}
          notes={filtered}
          activeId={activeId}
          query={query}
          onQuery={setQuery}
          onSelect={setActiveId}
          onCreate={newNote}
          onDelete={remove}
          onDuplicate={duplicate}
          onTogglePin={(n) => update(n.id, { pinned: !n.pinned })}
          footer={<FilesPanel workspace={wkey} />}
        />

        <main className="min-w-0 flex-1">
          {active ? (
            <EditorPane note={active} onUpdate={update} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-muted">
              <FileText className="h-10 w-10" />
              <p className="text-sm">{loading ? 'Loading…' : 'No note selected'}</p>
              <Button onClick={newNote}>Create your first note</Button>
            </div>
          )}
        </main>
      </div>

      <button
        onClick={onLeave}
        title="Leave workspace"
        className="fixed bottom-3 left-3 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted hover:bg-elevated hover:text-fg"
      >
        <LogOut className="h-3.5 w-3.5" /> leave
      </button>
    </div>
  )
}
