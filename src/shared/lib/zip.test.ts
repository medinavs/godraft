// node --experimental-strip-types src/shared/lib/zip.test.ts
import assert from 'node:assert'
import { uniqueName } from './zip.ts'

const taken: Record<string, true> = {}
for (const n of ['a.txt', 'a.txt', 'a.txt', 'README', 'README']) taken[uniqueName(taken, n)] = true

assert.deepStrictEqual(Object.keys(taken), ['a.txt', 'a (2).txt', 'a (3).txt', 'README', 'README (2)'])
console.log('ok')
