import { describe, expect, it } from 'vitest'
import { agyArgv, cursorArgv } from '../src/print-json-argv.ts'

describe('cursorArgv', () => {
  it('includes --force --trust in auto mode', () => {
    expect(cursorArgv({
      executable: '/bin/cursor-agent',
      cwd: '/tmp/ws',
      task: 'hello',
      unattended: 'auto',
    })).toEqual([
      '/bin/cursor-agent', '-p', '--output-format', 'json', '--force', '--trust',
      '--workspace', '/tmp/ws', '--', 'hello',
    ])
  })

  it('drops --force in strict mode', () => {
    expect(cursorArgv({
      executable: 'cursor-agent',
      cwd: '/tmp/ws',
      task: 'hello',
      unattended: 'strict',
    })).not.toContain('--force')
  })
})

describe('agyArgv', () => {
  it('uses --print json and a second-based timeout', () => {
    expect(agyArgv({
      executable: '/bin/agy',
      task: 'hello',
      unattended: 'auto',
      printTimeoutMs: 300_000,
    })).toEqual([
      '/bin/agy', '--dangerously-skip-permissions', '--output-format', 'json',
      '--print-timeout', '300s', '--print', 'hello',
    ])
  })
})
