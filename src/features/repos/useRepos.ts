import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useDialog } from '@/shared/components/ui/dialog'
import { formatBytes } from '@/shared/lib/utils'
import { collect, UNREADABLE } from './clipboard'
import { prepare, REPO_MAX_BYTES, type Rejected } from './repoTree'
import * as service from './reposService'
import type { ImportReport, Repo } from './reposService'

export type ImportState =
  | { phase: 'idle' }
  | { phase: 'detecting' }
  | { phase: 'importing'; name: string; done: number; total: number }
  | { phase: 'done' | 'partial'; report: ImportReport }
  | { phase: 'error'; message: string; details: Rejected[] }

const SKIP_GIT_KEY = 'godraft.repos.skipGit'

const byUpdated = (a: Repo, b: Repo) => b.updated_at.localeCompare(a.updated_at)

function noFilesMessage(rejected: Rejected[]): string {
  const blocked = rejected.find((r) => r.reason === UNREADABLE)
  if (blocked)
    return `The browser received "${blocked.path}" but not its contents — pasting folders isn't supported by this browser/OS. Drop the folder here, use Choose folder, or copy a .zip of it and paste that.`
  if (rejected.length) return 'None of the received files could be imported.'
  return 'The clipboard has no files. Copy the folder itself (not its path or text). From a VDI, file copy between the VDI and this PC must be enabled.'
}

export function useRepos(workspace: string) {
  const dlg = useDialog()
  const [repos, setRepos] = useState<Repo[]>([])
  const [state, setState] = useState<ImportState>({ phase: 'idle' })
  const abort = useRef<AbortController | null>(null)
  const reposRef = useRef(repos)
  reposRef.current = repos
  const [skipGit, setSkipGitState] = useState(() => localStorage.getItem(SKIP_GIT_KEY) !== '0')
  const skipGitRef = useRef(skipGit)
  skipGitRef.current = skipGit
  const setSkipGit = useCallback((v: boolean) => {
    setSkipGitState(v)
    localStorage.setItem(SKIP_GIT_KEY, v ? '1' : '0')
  }, [])

  useEffect(() => {
    let alive = true
    service.fetchRepos(workspace).then((r) => alive && setRepos(r)).catch(console.error)

    const channel = supabase
      .channel(`repos:${workspace}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'repos', filter: `workspace=eq.${workspace}` },
        (payload) => {
          setRepos((prev) => {
            if (payload.eventType === 'DELETE') return prev.filter((r) => r.id !== (payload.old as Repo).id)
            const row = payload.new as Repo
            return [...prev.filter((r) => r.id !== row.id), row].sort(byUpdated)
          })
        },
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [workspace])

  const upsertLocal = useCallback(
    (repo: Repo) => setRepos((prev) => [...prev.filter((r) => r.id !== repo.id), repo].sort(byUpdated)),
    [],
  )

  /**
   * Must be called synchronously from the paste/drop/change handler (see collect).
   * With a target, the received folder is diffed against it: only new/changed files are uploaded.
   */
  const importFrom = useCallback(
    (src: DataTransfer | FileList, target: Repo | null = null) => {
      const exclude = skipGitRef.current ? ['.git'] : []
      if (abort.current) return // one import at a time
      const received = collect(src)
      const ctl = new AbortController()
      abort.current = ctl
      setState({ phase: 'detecting' })

      void (async () => {
        try {
          const got = await received
          const prep = prepare(got.files, exclude)
          const rejected = [...got.rejected, ...prep.rejected]
          if (!prep.files.length && prep.excluded)
            return setState({ phase: 'error', message: 'Every received file was inside an excluded folder.', details: rejected })
          if (!prep.files.length) return setState({ phase: 'error', message: noFilesMessage(rejected), details: rejected })
          if (prep.bytes > REPO_MAX_BYTES)
            return setState({
              phase: 'error',
              message: `${formatBytes(prep.bytes)} exceeds the ${formatBytes(REPO_MAX_BYTES)} import limit.`,
              details: rejected,
            })

          let repo = target
          let name = target?.name ?? prep.root
          if (!repo) {
            name ??=
              (await dlg.prompt({ title: 'Repository name', placeholder: 'my-repo', confirmText: 'Import' }))?.trim() ||
              null
            if (!name) return setState({ phase: 'idle' })
            repo = reposRef.current.find((r) => r.name === name) ?? null
            if (
              repo &&
              !(await dlg.confirm({
                title: `Update "${name}"?`,
                message: 'A repository with this name exists. It will be replaced by this version; unchanged files are skipped.',
                confirmText: 'Update',
              }))
            )
              return setState({ phase: 'idle' })
          }

          const repoName = name!
          setState({ phase: 'importing', name: repoName, done: 0, total: prep.files.length })
          let last = 0
          const res = await service.importRepo({
            workspace,
            name: repoName,
            target: repo,
            files: prep.files,
            signal: ctl.signal,
            onProgress: (done, total) => {
              const now = performance.now()
              if (done < total && now - last < 100) return // throttle re-renders
              last = now
              setState({ phase: 'importing', name: repoName, done, total })
            },
          })
          upsertLocal(res.repo)
          res.report.failed.unshift(...rejected)
          res.report.excluded = prep.excluded
          setState({ phase: res.report.failed.length || res.report.cancelled ? 'partial' : 'done', report: res.report })
        } catch (e) {
          setState({ phase: 'error', message: e instanceof Error ? e.message : 'Import failed', details: [] })
        } finally {
          abort.current = null
        }
      })()
    },
    [workspace, dlg, upsertLocal],
  )

  const cancel = useCallback(() => abort.current?.abort(), [])
  const dismiss = useCallback(() => setState({ phase: 'idle' }), [])

  const remove = useCallback(async (repo: Repo) => {
    setRepos((prev) => prev.filter((r) => r.id !== repo.id))
    await service.deleteRepo(repo).catch(console.error)
  }, [])

  const busy = state.phase === 'detecting' || state.phase === 'importing'

  return { repos, state, busy, importFrom, cancel, dismiss, remove, upsertLocal, skipGit, setSkipGit }
}

export type ReposApi = ReturnType<typeof useRepos>
