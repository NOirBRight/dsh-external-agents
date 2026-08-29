/** Official types only. `dsh-client-runtime` was removed in DSH 0.1.2-alpha.1. */
export type { Context as ClientContext } from '@deepseek-ai/cordis'
export type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'

/** Structural wait used by Plan Review on both rc.2 respond and alpha.1 answer/cancel. */
export interface PendingWait<_K extends string> {
  readonly kind: _K
  readonly key: string
  readonly sessionId: unknown
  readonly payload?: { questions?: readonly unknown[] }
  readonly questions?: readonly unknown[]
  respond?(message: unknown): Promise<{ accepted: boolean }>
  answer?(answer: unknown): Promise<void>
  cancel?(): Promise<void>
}
