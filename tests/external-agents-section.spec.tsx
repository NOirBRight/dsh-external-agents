import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

import {
  ExternalAgentsSection,
  type ExternalAgentsSectionProps,
} from '../src/client/ExternalAgentsSection.tsx'
import type { Config } from '../src/exposure.ts'

const catalog = [{
  id: 'codex' as const,
  displayName: 'Codex',
  executable: 'codex',
  toolName: 'subagent_codex',
  docsUrl: 'https://example.test',
  loginMode: 'product-managed' as const,
  supportsUnattended: false,
  knownModels: [],
}]
const probes = { codex: { found: true, path: '/usr/bin/codex' } }

describe('ExternalAgentsSection', () => {
  it('does not restart initialization when the slot host rebuilds injected callbacks', async () => {
    const snapshot = {
      config: { adapters: { codex: { enabled: true, model: 'codex-model' } } },
      catalog,
      probes,
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

  it('saves the final enabled Adapter as disabled and keeps it disabled after reopen', async () => {
    const snapshot = {
      config: {
        adapters: { codex: { enabled: true, model: 'codex-model' } },
        defaultAdapter: 'codex' as const,
      },
      catalog,
      probes,
    }
    let persisted: Config = snapshot.config
    const save = vi.fn(async (next: Config) => { persisted = next })
    const props = {
      t: (key: string) => key,
      load: async () => ({ ...snapshot, config: persisted }),
      probe: async () => snapshot.probes,
      pick: async () => null,
      save,
    } as unknown as ExternalAgentsSectionProps
    let renderer: ReactTestRenderer | undefined
    await act(async () => {
      renderer = create(createElement(ExternalAgentsSection, props))
    })

    await act(async () => {
      renderer?.root.findByProps({ 'aria-label': 'disableAdapter: Codex' }).props.onChange()
    })
    expect(save).not.toHaveBeenCalled()

    await act(async () => {
      renderer?.root.findByProps({ 'aria-label': 'save' }).props.onClick()
    })

    expect(save).toHaveBeenCalledWith({
      adapters: { codex: { enabled: false, model: 'codex-model' } },
    })
    expect(renderer?.root.findByProps({ role: 'status' }).children).toEqual(['saved'])

    await act(async () => {
      renderer?.unmount()
      renderer = create(createElement(ExternalAgentsSection, props))
    })
    expect(renderer.root.findByProps({ 'aria-label': 'enableAdapter: Codex' }).props.checked).toBe(false)
  })
})
