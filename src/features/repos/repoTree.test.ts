// node --experimental-strip-types src/features/repos/repoTree.test.ts
import assert from 'node:assert'
import {
  buildTree,
  countDirs,
  decodeText,
  flatten,
  pool,
  prepare,
  REPO_MAX_FILE_BYTES,
  sanitizePath,
} from './repoTree.ts'

// paths
assert.equal(sanitizePath('/repo/cmd/api/main.go'), 'repo/cmd/api/main.go')
assert.equal(sanitizePath('repo\\internal\\.env'), 'repo/internal/.env')
assert.equal(sanitizePath('./a//b/./c'), 'a/b/c')
assert.equal(sanitizePath('repo/../../etc/passwd'), null)
assert.equal(sanitizePath('..'), null)
assert.equal(sanitizePath('a/b\u0000c'), null)
assert.equal(sanitizePath('///'), null)

// prepare: shared root stripped, dupes/oversized/malicious rejected, hidden files kept
const f = (path: string, size = 1) => ({ path, file: { size } })
const p = prepare([
  f('/atoken/go.mod'),
  f('/atoken/cmd/api/main.go'),
  f('/atoken/.gitignore'),
  f('/atoken/go.mod'),
  f('/atoken/../x'),
  f('/atoken/big.bin', REPO_MAX_FILE_BYTES + 1),
])
assert.equal(p.root, 'atoken')
assert.deepStrictEqual(p.files.map((x) => x.path), ['go.mod', 'cmd/api/main.go', '.gitignore'])
assert.deepStrictEqual(p.rejected.map((r) => r.reason), ['duplicate path', 'invalid path', 'larger than 25 MB'])
assert.equal(p.bytes, 3)
const ex = prepare([f('/r/.git/HEAD'), f('/r/.git/objects/ab/cd'), f('/r/sub/.git/x'), f('/r/.gitignore'), f('/r/a.go')], ['.git'])
assert.deepStrictEqual(ex.files.map((x) => x.path), ['.gitignore', 'a.go']) // .gitignore is a file, kept
assert.equal(ex.excluded, 3)
assert.equal(ex.rejected.length, 0)
assert.equal(prepare([f('a.go'), f('src/b.go')]).root, null) // loose files: no root
assert.equal(prepare([f('repo/a'), f('repo2/b')]).root, null)

// tree: dirs first, alphabetical, collapsed dirs hidden
const paths = ['go.mod', 'internal/service/s.go', 'cmd/api/main.go', 'README.md', 'internal/domain/d.go']
const tree = buildTree(paths)
assert.deepStrictEqual(flatten(tree, new Set()).map((r) => r.name), ['cmd', 'internal', 'go.mod', 'README.md'])
assert.deepStrictEqual(
  flatten(tree, new Set(['internal', 'internal/domain'])).map((r) => `${r.depth}:${r.path}`),
  ['0:cmd', '0:internal', '1:internal/domain', '2:internal/domain/d.go', '1:internal/service', '0:go.mod', '0:README.md'],
)
assert.equal(countDirs(paths), 5) // cmd, cmd/api, internal, internal/service, internal/domain

// text vs binary
assert.equal(decodeText(new TextEncoder().encode('package main\n')), 'package main\n')
assert.equal(decodeText(new Uint8Array([0x50, 0x00, 0x4b])), null)
assert.equal(decodeText(new Uint8Array([0xff, 0xfe, 0xfd])), null)

// pool: bounded concurrency, stops on abort
let inFlight = 0
let peak = 0
const seen: number[] = []
const ctl = new AbortController()
await pool(
  Array.from({ length: 20 }, (_, i) => i),
  3,
  async (i) => {
    peak = Math.max(peak, ++inFlight)
    await new Promise((r) => setTimeout(r, 1))
    seen.push(i)
    if (i === 9) ctl.abort()
    inFlight--
  },
  ctl.signal,
)
assert.equal(peak, 3)
assert.ok(seen.length >= 10 && seen.length < 20)

console.log('ok')
