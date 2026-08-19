import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseSkillMarkdown, routingSkillPath } from '../src/routing-skill.ts'

describe('delegate-product-worker skill', () => {
  it('parses frontmatter and forbids spawning the product CLI', () => {
    const parsed = parseSkillMarkdown(readFileSync(routingSkillPath(), 'utf8'))
    expect(parsed.name).toBe('delegate-product-worker')
    expect(parsed.description).toContain('Codex')
    expect(parsed.description).toContain('外部 Agent')
    expect(parsed.content).toContain('subagent_codex')
    expect(parsed.content).toContain('delegate_worker')
    expect(parsed.content).toMatch(/image|screenshot/i)
    expect(parsed.content).toContain('Do not spawn')
  })
})
