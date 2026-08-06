import { useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'

export function SecretGate({ onEnter }: { onEnter: (secret: string) => Promise<void> }) {
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!secret.trim() || busy) return
    setBusy(true)
    try {
      await onEnter(secret)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-2xl shadow-black/40"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover">
            <KeyRound className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">godraft</h1>
            <p className="mt-1 text-sm text-muted">
              Enter a shared secret to open your workspace. New secret, new workspace.
            </p>
          </div>
        </div>
        <Input
          autoFocus
          type="password"
          placeholder="your-secret-phrase"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
        <Button type="submit" className="mt-4 w-full" disabled={busy || !secret.trim()}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Open workspace
        </Button>
        <p className="mt-4 text-center text-xs text-muted">
          The secret is hashed locally — the server never sees it.
        </p>
      </form>
    </div>
  )
}
