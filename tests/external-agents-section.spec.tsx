import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

import {
  ExternalAgentsSection,
  type ExternalAgentsSectionProps,
} from '../src/client/ExternalAgentsSection.tsx'

describe('ExternalAgentsSection', () => {
  it('does not restart initialization when the slot host rebuilds injected callbacks', async () => {
    const snapshot = {
      config: { adapters: { codex: { enabled: true, model: 'codex-model' } } },
      catalog: [{
        id: 'codex' as const,
        displayName: 'Codex',
        executable: 'codex',
        toolName: 'subagent_codex',
        docsUrl: 'https://example.test',
        loginMode: 'product-managed' as const,
        supportsUnattended: false,
        knownModels: [],
      }],
      probes: { codex: { found: true, path: '/usr/bin/codex' } },
    }
    const load = vi.fn(async () => snapshot)
    const props = (): ExternalAgentsSectionProps => ({
      t: (key) => key,
      load: () => load(),
      probe: async () => snapshot.probes,
      pick: async () => null,
      save: async () => undefined,
    }) as unknown as ExternalAgentsSectionProps

    let renderer: ReactTestRenderer | undefined
    await act(async () => {
      renderer = create(createElement(ExternalAgentsSection, props()))
    })
    for (let index = 0; index < 3; index += 1) {
      await act(async () => {
        renderer?.update(createElement(ExternalAgentsSection, props()))
      })
    }

    expect(load).toHaveBeenCalledTimes(1)
    expect(renderer?.root.findAllByType('li')).toHaveLength(1)
  })
})
