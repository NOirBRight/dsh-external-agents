import { describe, expect, it } from 'vitest'
import { interpretPrintJson } from '../src/print-json-result.ts'

describe('interpretPrintJson', () => {
  it('accepts an Agy-shaped success object', () => {
    expect(interpretPrintJson({
      product: 'agy',
      displayName: 'Antigravity',
      exitCode: 0,
      stdout: JSON.stringify({
        conversation_id: 'x',
        status: 'SUCCESS',
        response: 'P1_AGY_OK\n',
      }),
      stderr: '',
    })).toEqual({ ok: true, text: 'P1_AGY_OK' })
  })

  it('accepts a Claude-shaped success object', () => {
    expect(interpretPrintJson({
      product: 'cursor',
      displayName: 'Cursor Agent',
      exitCode: 0,
      stdout: JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: 'P0_CURSOR_OK',
      }),
      stderr: '',
    })).toEqual({ ok: true, text: 'P0_CURSOR_OK' })
  })

  it('turns a login-shaped stderr into a readable Cursor error', () => {
    const outcome = interpretPrintJson({
      product: 'cursor',
      displayName: 'Cursor Agent',
      exitCode: 1,
      stdout: '',
      stderr: 'Error: not logged in. Run cursor-agent login',
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error).toContain('cursor-agent login')
  })

  it('surfaces a non-success JSON subtype', () => {
    const outcome = interpretPrintJson({
      product: 'agy',
      displayName: 'Antigravity',
      exitCode: 0,
      stdout: JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, result: '', errors: ['nope'] }),
      stderr: '',
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error).toContain('nope')
  })

  it('falls back to stderr when the process exits non-zero without JSON', () => {
    const outcome = interpretPrintJson({
      product: 'agy',
      displayName: 'Antigravity',
      exitCode: 2,
      stdout: 'not json',
      stderr: 'agy: command failed',
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error).toContain('agy: command failed')
  })
})
