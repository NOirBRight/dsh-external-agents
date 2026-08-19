/** Load and register the routing-only External Agents skill. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'

const SKILL_REL = join('skills', 'delegate-product-worker', 'SKILL.md')

export function routingSkillPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', SKILL_REL)
}

export function parseSkillMarkdown(raw: string): { name: string, description: string, content: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw)
  if (match === null) throw new Error('delegate-product-worker: SKILL.md is missing frontmatter')
  const front = match[1] ?? ''
  const content = (match[2] ?? '').trim()
  const name = /^name:\s*(.+)$/m.exec(front)?.[1]?.trim()
  const folded = /description:\s*>-\n([\s\S]*?)(?=\n[A-Za-z_-]+:|\n*$)/.exec(front)
  const description = folded?.[1]
    ?.split('\n')
    .map((line) => line.replace(/^\s{2}/, '').trim())
    .filter((line) => line.length > 0)
    .join(' ')
  if (name === undefined || description === undefined || content.length === 0) {
    throw new Error('delegate-product-worker: SKILL.md frontmatter is incomplete')
  }
  return { name, description, content }
}

export function registerRoutingSkill(ctx: Context): void {
  const skills = ctx.get('skills') as
    | { register: (skill: { name: string, description: string, source: 'runtime', content: string }) => (() => void) | void }
    | undefined
  if (skills === undefined) {
    ctx.logger.info('external-agents: skills registry missing; routing skill not registered')
    return
  }
  const parsed = parseSkillMarkdown(readFileSync(routingSkillPath(), 'utf8'))
  skills.register({
    name: parsed.name,
    description: parsed.description,
    source: 'runtime',
    content: parsed.content,
  })
}
