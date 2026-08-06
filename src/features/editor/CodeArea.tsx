import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { languageExtension } from './languages'
import type { Language } from '@/features/notes/types'

const transparentTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', height: '100%' },
  '.cm-gutters': { backgroundColor: 'transparent', borderRight: '1px solid var(--color-border)' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
})

export function CodeArea({
  value,
  language,
  onChange,
}: {
  value: string
  language: Language
  onChange: (v: string) => void
}) {
  const extensions = useMemo(
    () => [...languageExtension(language), transparentTheme, EditorView.lineWrapping],
    [language],
  )
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={oneDark}
      height="100%"
      basicSetup={{ foldGutter: false, highlightActiveLine: true, bracketMatching: true }}
      className="h-full text-sm"
    />
  )
}
