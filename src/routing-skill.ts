/** Load and register the routing-only External Agents skill. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import type {} from '@deepseek-ai/dsh-skill'

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

/** Register the routing skill when the optional skill registry is available. */
export function registerRoutingSkill(ctx: Context): void {
  const skills = ctx.get('skills')
  if (skills === undefined) {
    ctx.logger.warn('external-agents: skill capability unavailable; load @deepseek-ai/dsh-skill to register delegate-product-worker')
    return
  }
  const parsed = parseSkillMarkdown(readFileSync(routingSkillPath(), 'utf8'))
  const registration: SkillRegistration = {
    name: parsed.name,
    description: parsed.description,
    source: 'runtime',
    content: parsed.content,
  }
  ctx.effect(
    () => skills.register(registration),
    'external-agents: routing skill',
  )
}
