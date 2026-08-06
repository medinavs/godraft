import type { Extension } from '@codemirror/state'
import { StreamLanguage } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { sql } from '@codemirror/lang-sql'
import { yaml } from '@codemirror/lang-yaml'
import { go } from '@codemirror/lang-go'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import type { Language } from '@/features/notes/types'

export function languageExtension(lang: Language): Extension[] {
  switch (lang) {
    case 'go':
      return [go()]
    case 'typescript':
      return [javascript({ typescript: true })]
    case 'javascript':
      return [javascript()]
    case 'json':
      return [json()]
    case 'sql':
      return [sql()]
    case 'yaml':
      return [yaml()]
    case 'bash':
      return [StreamLanguage.define(shell)]
    default:
      return []
  }
}
