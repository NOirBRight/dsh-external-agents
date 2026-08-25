/** Browser half: External Agents page inside Settings. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'

import {
  EXTERNAL_AGENTS_RPC_CHANNEL,
  PICK_ENDPOINT,
  PROBE_ENDPOINT,
  SAVE_ENDPOINT,
  SNAPSHOT_ENDPOINT,
  decodeSnapshot,
} from '../client-contract.ts'
import type { AdapterId } from '../catalog.ts'
import type { AdapterProbe } from '../client-contract.ts'
import { decodeConfig } from '../config-codec.ts'
import { ExternalAgentsSection } from './ExternalAgentsSection.tsx'
import { CONTINUE_IN_DSH_SLOT, ExternalPlanReviewCard, type ExternalPlanReviewFace } from './ExternalPlanReviewCard.tsx'
import { selectPlanReview } from './plan-review.ts'
import type { ExternalAgentsFace } from './ExternalAgentsSection.tsx'
import { en, zh, type ExternalAgentsKey } from './locales.ts'

export { CONTINUE_IN_DSH_SLOT } from './ExternalPlanReviewCard.tsx'
export type { ContinueInDshOwner, PlanExternalAgentTarget, PlanTargetId, PlanWorkerTarget } from './ExternalPlanReviewCard.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.external-agents': ExternalAgentsKey
  }
}

export const name = 'dsh-external-agents-client'
export const inject = ['slots', 'locale', 'connection']

export function apply(ctx: ClientContext): void {
  const localeNamespace = 'settings.external-agents'
  ctx.effect(
    () => ctx.locale.register(localeNamespace, { zh, en }),
    'dsh-external-agents: Settings page copy',
  )
  const t = ctx.locale.bind(localeNamespace) as ExternalAgentsFace['t']
  const { rpc } = ctx.get('connection') as unknown as ConnectionHandle
  const load: ExternalAgentsFace['load'] = async () => {
    const result = await rpc.call(EXTERNAL_AGENTS_RPC_CHANNEL, SNAPSHOT_ENDPOINT, {}, undefined)
    if (!result.ok) throw new Error(result.error.message)
    const decoded = decodeSnapshot(result.value)
    if (decoded === undefined) throw new Error(t('failed'))
    return decoded
  }

  const probe: ExternalAgentsFace['probe'] = async (models) => {
    const result = await rpc.call(EXTERNAL_AGENTS_RPC_CHANNEL, PROBE_ENDPOINT, { models: models === true }, undefined)
    if (!result.ok) throw new Error(result.error.message)
    const value = result.value as { probes?: Partial<Record<AdapterId, AdapterProbe>> }
    return value.probes ?? {}
  }

  const loadPlanTargets = async (): Promise<import('../client-contract.ts').ExternalAgentsSnapshot> => {
    const snapshot = await load()
    try {
      const probes = await probe(false)
      return { ...snapshot, probes }
    } catch {
      return snapshot
    }
  }

  const pick: ExternalAgentsFace['pick'] = async () => {
    const result = await rpc.call(EXTERNAL_AGENTS_RPC_CHANNEL, PICK_ENDPOINT, {}, undefined)
    if (!result.ok) throw new Error(result.error.message)
    const value = result.value as { path?: string | null }
    return value.path ?? null
  }


  const save: ExternalAgentsFace['save'] = async (config) => {
    const payload = decodeConfig(config) ?? config
    const result = await rpc.call(EXTERNAL_AGENTS_RPC_CHANNEL, SAVE_ENDPOINT, payload, undefined)
    if (!result.ok) throw new Error(result.error.message)
  }

  ctx.inject(['slots'], (scope: ClientContext) => {
    scope.slots.inject('conversation.composer', () => scope.slots.register({
      name: 'conversation.composer',
      locale: localeNamespace,
      priority: -6,
      select: (owner: ComposerChainProps) => selectPlanReview(owner),
      children: {
        [CONTINUE_IN_DSH_SLOT]: { kind: 'single', scope: 'session' },
      },
      inject: (): ExternalPlanReviewFace => ({ loadTargets: loadPlanTargets }),
    }, ExternalPlanReviewCard))
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'external-agents',
    order: 14,
    label: () => t('nav'),
    inject: (): ExternalAgentsFace => ({ t, load, probe, pick, save }),
  }, ExternalAgentsSection))
}
