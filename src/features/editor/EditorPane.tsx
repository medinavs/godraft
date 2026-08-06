import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { LANGUAGES, type Note, type NotePatch, type EditorMode, type Language } from '@/features/notes/types'

const CodeArea = lazy(() => import('./CodeArea').then((m) => ({ default: m.CodeArea })))

const AUTOSAVE_MS = 600

export function EditorPane({
  note,
  onUpdate,
}: {
  note: Note
  onUpdate: (id: string, patch: NotePatch) => void
}) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [mode, setMode] = useState<EditorMode>(note.mode)
  const [language, setLanguage] = useState<Language>(note.language)
  const [copied, setCopied] = useState(false)
  const dirty = useRef(false)

  useEffect(() => {
    dirty.current = false
    setTitle(note.title)
    setContent(note.content)
    setMode(note.mode)
    setLanguage(note.language)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id])

  useEffect(() => {
    if (dirty.current) return
    setTitle(note.title)
    setContent(note.content)
    setMode(note.mode)
    setLanguage(note.language)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.updated_at])

  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(() => {
      onUpdate(note.id, { title, content, mode, language })
      dirty.current = false
    }, AUTOSAVE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, mode, language])

  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    dirty.current = true
    setter(v)
  }

  const copy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') e.preventDefault()
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        void copy()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <input
          value={title}
          onChange={(e) => edit(setTitle)(e.target.value)}
          placeholder="Untitled"
          className="min-w-40 flex-1 bg-transparent text-lg font-semibold text-fg outline-none placeholder:text-muted"
        />

        <div className="flex items-center rounded-lg border border-border p-0.5 text-sm">
          {(['text', 'code'] as EditorMode[]).map((m) => (
            <button
              key={m}
              onClick={() => edit(setMode)(m)}
              className={`rounded-md px-3 py-1 transition-colors ${
                mode === m ? 'bg-elevated text-fg' : 'text-muted hover:text-fg'
              }`}
            >
              {m === 'text' ? 'Plain' : 'Code'}
            </button>
          ))}
        </div>

        {mode === 'code' && (
          <select
            value={language}
            onChange={(e) => edit(setLanguage)(e.target.value as Language)}
            className="h-8 rounded-lg border border-border bg-surface px-2 text-sm capitalize text-fg outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}

        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {mode === 'code' ? (
          <Suspense fallback={<div className="px-5 py-4 text-sm text-muted">Loading editor…</div>}>
            <CodeArea value={content} language={language} onChange={edit(setContent)} />
          </Suspense>
        ) : (
          <textarea
            value={content}
            onChange={(e) => edit(setContent)(e.target.value)}
            placeholder="Start typing…"
            spellCheck={false}
            className="h-full w-full resize-none bg-transparent px-5 py-4 font-mono text-sm leading-relaxed text-fg outline-none placeholder:text-muted"
          />
        )}
      </div>
    </div>
  )
}
