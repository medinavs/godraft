import { useCallback, useEffect, useState } from 'react'
import { hashSecret } from '@/shared/lib/utils'

const KEY = 'godraft.secret'

export interface Workspace {
  secret: string
  key: string // sha-256 hex, used as the DB workspace id
  name: string
}

async function build(secret: string): Promise<Workspace> {
  const key = await hashSecret(secret)
  return { secret, key, name: `ws-${key.slice(0, 6)}` }
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(KEY)
    if (saved) build(saved).then(setWorkspace).finally(() => setReady(true))
    else setReady(true)
  }, [])

  const enter = useCallback(async (secret: string) => {
    const ws = await build(secret)
    localStorage.setItem(KEY, secret)
    setWorkspace(ws)
  }, [])

  const leave = useCallback(() => {
    localStorage.removeItem(KEY)
    setWorkspace(null)
  }, [])

  return { workspace, ready, enter, leave }
}
