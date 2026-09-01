import { useMemo } from 'react'
import { marked } from 'marked'

// ponytail: no HTML sanitizer. Content is authored only by holders of the
// workspace secret (i.e. you, across your own devices) — no third-party input.
// Add DOMPurify if the workspace is ever shared with people you don't trust.
export function MarkdownPreview({ content }: { content: string }) {
  const html = useMemo(() => marked.parse(content, { async: false }) as string, [content])
  return (
    <div
      className="md-preview px-5 py-4 text-sm leading-relaxed"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
