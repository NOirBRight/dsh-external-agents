import { describe, expect, it } from 'vitest'
import * as published from 'dsh-external-agents'

const DSH_RANGE = '>=0.1.2-alpha.4 <1.0.0 || 0.1.2-alpha.5 || 0.1.2-rc.1'

describe('published package root', () => {
  it('keeps Host singleton modules on the platform module table', async () => {
    const fs = await import('node:fs')
    const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    for (const name of ['@deepseek-ai/dsh-scope', '@deepseek-ai/dsh-tool-subagent']) {
      expect(manifest.dependencies).not.toHaveProperty(name)
      expect(manifest.peerDependencies).toHaveProperty(name, DSH_RANGE)
      expect(manifest.devDependencies).toHaveProperty(name, '0.1.2-alpha.4')
    }
  })

  it('exports only the External Agents control-plane seam', () => {
    expect(typeof published.apply).toBe('function')
    expect(published.name).toBe('external-agents')
    expect(published.EXTERNAL_AGENTS_RPC_CHANNEL).toBe('/external-agents')
    expect(published.SNAPSHOT_ENDPOINT).toBe('snapshot')
    expect(published.SAVE_ENDPOINT).toBe('save')
    expect(published.PROBE_ENDPOINT).toBe('probe')
    expect(published.PICK_ENDPOINT).toBe('pick')
    expect(published.ADAPTER_IDS).toEqual(['codex', 'claude-code', 'cursor', 'antigravity'])
    // No Plan exports remain
    expect(published).not.toHaveProperty('CONTINUE_IN_DSH_SLOT')
    expect(published).not.toHaveProperty('PLAN_PREPARE_ENDPOINT')
    expect(published).not.toHaveProperty('PLAN_COMMIT_ENDPOINT')
    expect(published).not.toHaveProperty('EXTERNAL_PLAN_HANDOFF_UNAVAILABLE')
    expect(published).not.toHaveProperty('handoffPlan')
    expect(String(Object.keys(published))).not.toContain('plan')
  })

  it('client exports only settings UI contributions', async () => {
    // Client entry is a browser ModuleLoader bundle (requires window); verify via built file content instead of node import
    const fs = await import('node:fs')
    const clientCode = fs.readFileSync('lib/client.js', 'utf8')
    expect(clientCode).toContain('dsh-external-agents')
    expect(clientCode).toContain('settings.section')
    expect(clientCode).not.toContain('CONTINUE_IN_DSH_SLOT')
    expect(clientCode).not.toContain('external-agents.plan-review')
    expect(clientCode).not.toContain('conversation.composer')
  })

  it('contains no forbidden Plan/Composer identifiers in public code', async () => {
    const forbidden = [
      'plan.prepare', 'plan.commit', 'external-agents.plan-review', 'CONTINUE_IN_DSH_SLOT', 'EXTERNAL_PLAN_HANDOFF_UNAVAILABLE',
      'conversation.composer', 'composer-picker', 'model-switch', 'PlanReview', 'plan-review'
    ]
    const serialized = JSON.stringify(Object.keys(published))
    for (const token of forbidden) {
      if (token === 'plan-review' || token === 'PlanReview') {
        expect(serialized.toLowerCase()).not.toContain(token.toLowerCase())
      } else {
        expect(serialized).not.toContain(token)
      }
    }
    const fs = await import('node:fs')
    const libCode = fs.readFileSync('lib/index.js', 'utf8') + fs.readFileSync('lib/client.js', 'utf8')
    for (const token of forbidden) {
      expect(libCode).not.toContain(token)
    }
  })
})
