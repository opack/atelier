import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'
import { applyToolEdit, matchesAny, parseFrontMatter, parsePorcelainPaths, setFrontMatterValues, toProjectRelativePath } from '../lib/common.mjs'

describe('front matter', () => {
  it('parses values and ignores trailing comments', () => {
    const { data, body } = parseFrontMatter('---\nid: FEAT-1\nstatus: draft # comment\nsigned_by:\n---\n# Body')
    assert.deepEqual(data, { id: 'FEAT-1', status: 'draft', signed_by: '' })
    assert.equal(body, '# Body')
  })

  it('updates existing keys and appends missing ones without touching the body', () => {
    const updated = setFrontMatterValues('---\nid: FEAT-1\nstatus: draft\n---\n# Body\n', { status: 'signed', signed_at: '2026-11-09' })
    assert.equal(updated, '---\nid: FEAT-1\nstatus: signed\nsigned_at: 2026-11-09\n---\n# Body\n')
  })
})

describe('project relative paths', () => {
  it('tells files outside the project apart, other drives and case included on Windows', () => {
    assert.equal(toProjectRelativePath('C:\\proj', 'C:\\proj\\src\\a.ts', path.win32), 'src/a.ts')
    assert.equal(toProjectRelativePath('C:\\Proj', 'c:\\proj\\src\\a.ts', path.win32), 'src/a.ts')
    assert.equal(toProjectRelativePath('C:\\proj', 'D:\\proj\\src\\a.ts', path.win32), null)
    assert.equal(toProjectRelativePath('C:\\proj', 'C:\\other\\a.ts', path.win32), null)
    assert.equal(toProjectRelativePath('/proj', '/proj/..cache/a.ts', path.posix), '..cache/a.ts')
  })
})

describe('git output', () => {
  it('reads unquoted paths, non-ASCII and renames included', () => {
    const output = ' M docs/notes/réunion.md\0?? src/a b.ts\0R  src/new.ts\0src/old.ts\0'
    assert.deepEqual(parsePorcelainPaths(output), ['docs/notes/réunion.md', 'src/a b.ts', 'src/new.ts'])
    assert.deepEqual(parsePorcelainPaths(''), [])
  })
})

describe('tool edits', () => {
  it('computes the text after Edit, MultiEdit and Write', () => {
    assert.equal(applyToolEdit('a\r\nb\r\nb', 'Edit', { old_string: 'b', new_string: '$&c' }), 'a\n$&c\nb')
    assert.equal(applyToolEdit('a\nb\nb', 'Edit', { old_string: 'b', new_string: 'c', replace_all: true }), 'a\nc\nc')
    assert.equal(applyToolEdit('a\nb', 'MultiEdit', { edits: [{ old_string: 'a', new_string: 'x' }, { old_string: 'x\nb', new_string: 'y' }] }), 'y')
    assert.equal(applyToolEdit(null, 'Write', { content: 'new' }), 'new')
  })

  it('returns null when the edit cannot apply', () => {
    assert.equal(applyToolEdit('a', 'Edit', { old_string: 'z', new_string: 'y' }), null)
    assert.equal(applyToolEdit(null, 'Edit', { old_string: 'a', new_string: 'y' }), null)
    assert.equal(applyToolEdit('a', 'NotebookEdit', {}), null)
  })
})

describe('path patterns', () => {
  it('matches directory, glob and name patterns', () => {
    assert.ok(matchesAny('docs/a/b.md', ['docs/**']))
    assert.ok(matchesAny('config/.env.local', ['.env.*']))
    assert.ok(matchesAny('src/secrets/token.txt', ['**/secrets/**']))
    assert.ok(!matchesAny('src/environment.ts', ['.env', '.env.*']))
  })
})
