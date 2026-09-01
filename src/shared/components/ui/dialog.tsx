import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Button } from './button'
import { Input } from './input'

interface PromptOpts {
  title: string
  message?: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
}
interface ConfirmOpts {
  title: string
  message?: string
  confirmText?: string
  danger?: boolean
}

interface DialogApi {
  prompt: (o: PromptOpts) => Promise<string | null>
  confirm: (o: ConfirmOpts) => Promise<boolean>
}

const Ctx = createContext<DialogApi | null>(null)

export function useDialog(): DialogApi {
  const api = useContext(Ctx)
  if (!api) throw new Error('useDialog must be used within <DialogProvider>')
  return api
}

type State =
  | ({ kind: 'prompt'; resolve: (v: string | null) => void } & PromptOpts)
  | ({ kind: 'confirm'; resolve: (v: boolean) => void } & ConfirmOpts)

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State | null>(null)
  const [value, setValue] = useState('')

  const prompt = useCallback(
    (o: PromptOpts) =>
      new Promise<string | null>((resolve) => {
        setValue(o.defaultValue ?? '')
        setState({ kind: 'prompt', resolve, ...o })
      }),
    [],
  )
  const confirm = useCallback(
    (o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ kind: 'confirm', resolve, ...o })),
    [],
  )

  const cancel = useCallback(() => {
    if (!state) return
    state.kind === 'prompt' ? state.resolve(null) : state.resolve(false)
    setState(null)
  }, [state])

  const accept = useCallback(() => {
    if (!state) return
    state.kind === 'prompt' ? state.resolve(value) : state.resolve(true)
    setState(null)
  }, [state, value])

  useEffect(() => {
    if (!state) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && cancel()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [state, cancel])

  return (
    <Ctx.Provider value={{ prompt, confirm }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={cancel}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              accept()
            }}
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl shadow-black/50"
          >
            <h2 className="text-base font-semibold text-fg">{state.title}</h2>
            {state.message && <p className="mt-1 text-sm text-muted">{state.message}</p>}
            {state.kind === 'prompt' && (
              <Input
                autoFocus
                value={value}
                placeholder={state.placeholder}
                onChange={(e) => setValue(e.target.value)}
                className="mt-4"
              />
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={cancel}>
                Cancel
              </Button>
              <Button
                type="submit"
                autoFocus={state.kind === 'confirm'}
                disabled={state.kind === 'prompt' && !value.trim()}
                className={state.kind === 'confirm' && state.danger ? 'bg-red-600 hover:bg-red-500' : ''}
              >
                {state.confirmText ?? (state.kind === 'confirm' ? 'Confirm' : 'Save')}
              </Button>
            </div>
          </form>
        </div>
      )}
    </Ctx.Provider>
  )
}
