/**
 * Closed shipped Adapter set. New workers require a new ADR.
 * @module dsh-external-agents/catalog
 */

export const ADAPTER_IDS = ['codex', 'claude-code', 'cursor', 'antigravity'] as const

export type AdapterId = (typeof ADAPTER_IDS)[number]

/** Official DSH packages this plugin mounts. */
export const OFFICIAL_ADAPTER_IDS = ['codex', 'claude-code'] as const

export type OfficialAdapterId = (typeof OFFICIAL_ADAPTER_IDS)[number]

/** Adapters this plugin implements (official packages plus print-json workers). */
export const IMPLEMENTED_ADAPTER_IDS = ['codex', 'claude-code', 'cursor', 'antigravity'] as const

export type ImplementedAdapterId = (typeof IMPLEMENTED_ADAPTER_IDS)[number]

export interface AdapterDescriptor {
  readonly id: AdapterId
  readonly provider: string
  readonly toolName: string
  readonly executable: string
  readonly displayName: string
  readonly implemented: boolean
  readonly docsUrl: string
  readonly loginMode: 'cursor-status' | 'product-managed'
  readonly supportsUnattended: boolean
  /** Curated --model ids. Maintained here; CLI listing is optional refresh. */
  readonly knownModels: readonly { readonly id: string, readonly label: string }[]
}

export const ADAPTERS: Record<AdapterId, AdapterDescriptor> = {
  codex: {
    id: 'codex',
    provider: 'codex',
    toolName: 'subagent_codex',
    executable: 'codex',
    displayName: 'Codex',
    implemented: true,
    docsUrl: 'https://developers.openai.com/codex',
    loginMode: 'product-managed',
    supportsUnattended: false,
    knownModels: [
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
    ],
  },
  'claude-code': {
    id: 'claude-code',
    provider: 'claude-code',
    toolName: 'subagent_claude_code',
    executable: 'claude',
    displayName: 'Claude Code',
    implemented: true,
    docsUrl: 'https://code.claude.com/docs/en/overview',
    loginMode: 'product-managed',
    supportsUnattended: false,
    knownModels: [
      { id: 'fable', label: 'Fable' },
      { id: 'opus', label: 'Opus' },
      { id: 'sonnet', label: 'Sonnet' },
      { id: 'haiku', label: 'Haiku' },
    ],
  },
  cursor: {
    id: 'cursor',
    provider: 'cursor',
    toolName: 'worker_cursor',
    executable: 'cursor-agent',
    displayName: 'Cursor Agent',
    implemented: true,
    docsUrl: 'https://docs.cursor.com/en/cli/overview',
    loginMode: 'cursor-status',
    supportsUnattended: true,
    knownModels: [
      { id: 'auto', label: 'Auto' },
      { id: 'composer-2.5', label: 'Composer 2.5' },
      { id: 'gpt-5.3-codex', label: 'Codex 5.3' },
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
      { id: 'cursor-grok-4.6-high', label: 'Grok 4.6' },
      { id: 'claude-opus-5-thinking-high', label: 'Opus 5 Thinking' },
      { id: 'claude-fable-5-thinking-high', label: 'Fable 5 Thinking' },
      { id: 'claude-sonnet-5-thinking-high', label: 'Sonnet 5 Thinking' },
      { id: 'gemini-3.7-flash-high', label: 'Gemini 3.7 Flash' },
      { id: 'kimi-k3-max', label: 'Kimi K3' },
      { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code' },
      { id: 'glm-5.2-high', label: 'GLM 5.2' },
    ],
  },
  antigravity: {
    id: 'antigravity',
    provider: 'antigravity',
    toolName: 'worker_antigravity',
    executable: 'agy',
    displayName: 'Antigravity',
    implemented: true,
    docsUrl: 'https://www.antigravity.google/docs/cli-overview',
    loginMode: 'product-managed',
    supportsUnattended: true,
    knownModels: [
      { id: 'gemini-3.7-flash-high', label: 'Gemini 3.7 Flash' },
      { id: 'gemini-3.1-pro-high', label: 'Gemini 3.1 Pro' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'claude-opus-4-6-thinking', label: 'Claude Opus 4.6' },
      { id: 'gpt-oss-120b-medium', label: 'GPT-OSS 120B' },
    ],
  },
}

export const GENERIC_TOOL_NAME = 'delegate_worker'

export const ENABLE_HINT =
  '在设置的「外部 Agent」页启用该工人，或在 profile 的 cordis.patch.yml 里改 adapters.<id>.enabled。'

export function isAdapterId(value: string): value is AdapterId {
  return (ADAPTER_IDS as readonly string[]).includes(value)
}

export function isOfficialAdapterId(value: string): value is OfficialAdapterId {
  return (OFFICIAL_ADAPTER_IDS as readonly string[]).includes(value)
}

export function isImplementedAdapterId(value: string): value is ImplementedAdapterId {
  return (IMPLEMENTED_ADAPTER_IDS as readonly string[]).includes(value)
}
