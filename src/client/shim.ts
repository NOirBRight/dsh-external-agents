// Alpha.1 type shim: the client Runtime package was removed upstream.
export type ClientContext = import('@deepseek-ai/cordis').Context & Record<string, any>
// Structural view of the rc.2 PendingWait class: this plugin reads kind, key,
// sessionId, payload, and calls respond(). The runtime object is the alpha.1
// class from ui-user-questions, which carries the same members.
export interface PendingWait<_K extends string> {
  readonly kind: _K
  readonly key: string
  readonly sessionId: unknown
  readonly payload?: { questions?: readonly unknown[] } & Record<string, unknown>
  readonly questions?: readonly unknown[]
  respond?(message: unknown): Promise<{ accepted: boolean }>
  answer?(answer: unknown): Promise<void>
  cancel?(): Promise<void>
}
