/** External Agents settings page. */

import { useEffect, useId, useRef, useState, type CSSProperties, type JSX } from 'react'
import { createPortal } from 'react-dom'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { AdapterId } from '../catalog.ts'
import type { AdapterProbe, CatalogCard, ExternalAgentsSnapshot } from '../client-contract.ts'
import type { AdapterConfig, Config } from '../exposure.ts'
import { AGY_ICON_SRC } from './agy-icon.ts'
import type { ExternalAgentsKey } from './locales.ts'

export interface ExternalAgentsFace {
  t: (key: ExternalAgentsKey) => string
  load: () => Promise<ExternalAgentsSnapshot>
  probe: (models?: boolean) => Promise<Partial<Record<AdapterId, AdapterProbe>>>
  pick: () => Promise<string | null>
  save: (config: Config) => Promise<void>
}

export type ExternalAgentsSectionProps =
  PropsRuntime<'settings.section'>
  & InjectFace<ExternalAgentsFace>

const CLAUDE_MODEL_LABELS: Record<string, string> = {
  fable: 'Fable',
  opus: 'Opus',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
}

function modelOptions(
  card: CatalogCard,
  probe: AdapterProbe | undefined,
  current: string | undefined,
): Array<{ id: string, label: string }> {
  const byId = new Map<string, string>()
  for (const row of card.knownModels) byId.set(row.id, row.label)
  for (const id of probe?.models ?? []) {
    if (!byId.has(id)) byId.set(id, CLAUDE_MODEL_LABELS[id] ?? id)
  }
  if (current !== undefined && current.length > 0 && !byId.has(current)) {
    byId.set(current, CLAUDE_MODEL_LABELS[current] ?? current)
  }
  return [...byId.entries()].map(([id, label]) => ({ id, label }))
}

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 760,
  color: 'var(--dsw-alias-label-primary)',
  scrollbarGutter: 'stable',
}
const titleStyle: CSSProperties = { margin: 0, fontSize: 20, fontWeight: 600, lineHeight: '28px' }
const introStyle: CSSProperties = { margin: 0, fontSize: 14, lineHeight: '22px', color: 'var(--dsw-alias-label-tertiary)' }
const cardsStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: 14,
}

function cardShell(active: boolean, missing: boolean): CSSProperties {
  return {
    border: '1px solid ' + (active ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-border-l2)'),
    borderRadius: 14,
    display: 'flex',
    flexDirection: 'column',
    background: active ? 'var(--dsw-alias-bg-layer-2)' : 'var(--dsw-alias-bg-layer-3)',
    opacity: missing ? 0.7 : 1,
    minWidth: 0,
  }
}

const headBtn: CSSProperties = {
  appearance: 'none',
  border: 0,
  background: 'none',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '16px 16px 10px',
}
const nameStyle: CSSProperties = { fontSize: 16, fontWeight: 600, lineHeight: '22px' }
const badge: CSSProperties = {
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 12,
  lineHeight: '18px',
  fontWeight: 500,
  border: '1px solid var(--dsw-alias-border-l2)',
  color: 'var(--dsw-alias-label-tertiary)',
}
const inUseBadge: CSSProperties = {
  ...badge,
  marginLeft: 'auto',
  border: 0,
  background: 'var(--dsw-alias-label-primary)',
  color: 'var(--dsw-alias-bg-layer-3)',
}
const foot: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 16px 16px' }
const meta: CSSProperties = { fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary)' }

function BrandIcon({ id }: { id: AdapterId }): JSX.Element {
  const box = { width: 28, height: 28, viewBox: '0 0 24 24', 'aria-hidden': true as const }
  if (id === 'codex') {
    return <svg {...box} fill='#10A37F'><path d='M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2054 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654 2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z' /></svg>
  }
  if (id === 'claude-code') {
    return <svg {...box} fill='#D97757'><path d='M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z' /></svg>
  }
  if (id === 'cursor') {
    return <svg {...box} fill='currentColor'><path d='M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.294-.508L2.36 6.853c-.133-.228.034-.515.297-.515' /></svg>
  }
  return <img src={AGY_ICON_SRC} width={28} height={28} alt='' style={{ borderRadius: 6 }} />
}

function ChipSelect(props: {
  value: string
  options: Array<{ id: string, label: string }>
  placeholder: string
  onChange: (value: string) => void
}): JSX.Element {
  const { value, options, placeholder, onChange } = props
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState<{ top: number, left: number, width: number, maxHeight: number } | undefined>(undefined)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const id = useId()
  const label = options.find((row) => row.id === value)?.label ?? placeholder
  useEffect(() => {
    if (!open) return
    const place = (): void => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect === undefined) return
      const gap = 8
      const want = Math.min(280, options.length * 40 + 48)
      const below = window.innerHeight - rect.bottom - 12
      const above = rect.top - 12
      const openUp = below < 160 && above > below
      const maxHeight = Math.max(120, Math.min(want, openUp ? above - gap : below - gap))
      setMenu({
        top: openUp ? rect.top - maxHeight - gap : rect.bottom + gap,
        left: rect.left,
        width: rect.width,
        maxHeight,
      })
    }
    place()
    const close = (event: MouseEvent): void => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) === true) return
      if (menuRef.current?.contains(target) === true) return
      setOpen(false)
    }
    window.addEventListener('resize', place)
    document.addEventListener('mousedown', close)
    return () => {
      window.removeEventListener('resize', place)
      document.removeEventListener('mousedown', close)
    }
  }, [open, options.length])
  return (
    <div ref={rootRef} style={{ position: 'relative', minWidth: 0 }}>
      <button
        type='button'
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-controls={id}
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          height: 32,
          padding: '0 8px 0 12px',
          border: 'none',
          borderRadius: 24,
          background: 'var(--dsw-alias-interactive-bg-hover)',
          color: 'var(--dsw-alias-label-secondary)',
          fontSize: 14,
          lineHeight: '20px',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <svg width='14' height='14' viewBox='0 0 14 14' aria-hidden style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : undefined }}>
          <path d='M3 5l4 4 4-4' fill='none' stroke='currentColor' strokeWidth='1.4' />
        </svg>
      </button>
      {open && menu !== undefined ? createPortal(
        <div
          ref={menuRef}
          id={id}
          role='listbox'
          style={{
            position: 'fixed',
            top: menu.top,
            left: menu.left,
            width: menu.width,
            maxHeight: menu.maxHeight,
            zIndex: 10000,
            overflow: 'auto',
            padding: 4,
            border: '1px solid var(--dsw-alias-border-inverted)',
            borderRadius: 12,
            background: 'var(--dsw-specific-menu)',
            boxShadow: 'var(--dsw-shadow-lv3)',
          }}
        >
          {[{ id: '', label: placeholder }, ...options].map((row) => (
            <button
              key={row.id || 'default'}
              type='button'
              role='option'
              aria-selected={row.id === value}
              onClick={() => { onChange(row.id); setOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                minHeight: 38,
                padding: '6px 10px',
                border: 'none',
                borderRadius: 8,
                background: row.id === value ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
                color: 'var(--dsw-alias-label-primary)',
                fontSize: 14,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              {row.label}
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

function SkeletonCard(): JSX.Element {
  const bar = (width: string, height: number): CSSProperties => ({
    width,
    height,
    borderRadius: 8,
    background: 'linear-gradient(90deg, var(--dsw-alias-bg-layer-2) 20%, var(--dsw-alias-bg-layer-1) 40%, var(--dsw-alias-bg-layer-2) 60%)',
    backgroundSize: '240% 100%',
    animation: 'dsh-ea-shimmer 1.1s linear infinite',
  })
  return (
    <li style={cardShell(false, false)}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ ...bar('28px', 28), borderRadius: 8 }} />
          <div style={bar('46%', 16)} />
        </div>
        <div style={bar('70%', 12)} />
        <div style={{ ...bar('100%', 32), borderRadius: 16 }} />
      </div>
    </li>
  )
}

function loginText(probe: AdapterProbe | undefined, t: ExternalAgentsFace['t']): string | undefined {
  if (probe?.found !== true) return undefined
  if (probe.login === 'ok') return probe.loginDetail ?? t('loggedIn')
  if (probe.login === 'product-managed') return t('loginManaged')
  return probe.loginDetail
}

function AdapterCard(props: {
  card: CatalogCard
  row: AdapterConfig
  probe: AdapterProbe | undefined
  inUse: boolean
  t: ExternalAgentsFace['t']
  onPickDefault: () => void
  onChange: (next: AdapterConfig, persist: boolean) => void
  onLocate: () => void
}): JSX.Element {
  const { card, row, probe, inUse, t, onPickDefault, onChange, onLocate } = props
  const enabled = row.enabled === true
  const missing = probe?.found !== true
  const status = !enabled ? t('disabledBadge') : missing ? t('missingBadge') : t('enabledBadge')
  return (
    <li style={cardShell(inUse, missing || !enabled)}>
      <button
        type='button'
        style={{ ...headBtn, cursor: inUse || !enabled ? 'default' : 'pointer' }}
        aria-pressed={inUse}
        disabled={inUse || !enabled}
        aria-label={(inUse ? t('inUse') : t('setDefault')) + ': ' + card.displayName}
        onClick={onPickDefault}
      >
        <BrandIcon id={card.id} />
        <span style={nameStyle}>{card.displayName}</span>
        <span style={badge}>{status}</span>
        {inUse ? <span style={inUseBadge}>{t('inUse')}</span> : null}
      </button>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 8px', fontSize: 13, color: 'var(--dsw-alias-label-secondary)' }}>
        <input
          type='checkbox'
          checked={enabled}
          aria-label={(enabled ? t('disableAdapter') : t('enableAdapter')) + ': ' + card.displayName}
          onChange={() => onChange({ ...row, enabled: !enabled }, true)}
        />
        {enabled ? t('enabledBadge') : t('disabledBadge')}
      </label>
      <div style={foot}>
        <div style={meta}>{[probe?.version, loginText(probe, t)].filter(Boolean).join(' · ')}</div>
        {missing ? (
          <button
            type='button'
            onClick={onLocate}
            style={{
              height: 32,
              border: '1px solid var(--dsw-alias-border-l2)',
              borderRadius: 24,
              background: 'transparent',
              color: 'inherit',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t('locate')}
          </button>
        ) : (
          <ChipSelect
            value={row.model ?? ''}
            placeholder={t('productDefault')}
            options={modelOptions(card, probe, row.model)}
            onChange={(value) => {
              const next = { ...row }
              if (value === '') delete next.model
              else next.model = value
              onChange(next, true)
            }}
          />
        )}
      </div>
    </li>
  )
}

export function ExternalAgentsSection(props: ExternalAgentsSectionProps): JSX.Element {
  const { t, load, probe, pick, save } = props
  const [snapshot, setSnapshot] = useState<ExternalAgentsSnapshot | undefined>(undefined)
  const [draft, setDraft] = useState<Config>({})
  const [probes, setProbes] = useState<Partial<Record<AdapterId, AdapterProbe>>>({})
  const [probing, setProbing] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)
  const loadRef = useRef(load)
  const probeRef = useRef(probe)
  loadRef.current = load
  probeRef.current = probe

  useEffect(() => {
    let cancelled = false
    const started = Date.now()
    void loadRef.current().then(async (next) => {
      if (cancelled) return
      setSnapshot(next)
      setDraft(next.config)
      const cached = next.probes
      if (Object.keys(cached).length > 0) {
        setProbes(cached)
        setProbing(false)
        return
      }
      const fresh = await probeRef.current(false)
      const wait = 280 - (Date.now() - started)
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      if (cancelled) return
      setProbes(fresh)
      setProbing(false)
    }).catch((cause: unknown) => {
      if (!cancelled) {
        setError(String(cause))
        setProbing(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const persist = (next: Config): void => {
    setDraft(next)
    void save(next).catch((cause: unknown) => setError(String(cause)))
  }

  const setAdapter = (id: AdapterId, row: AdapterConfig): void => {
    persist({ ...draft, adapters: { ...draft.adapters, [id]: row } })
  }

  const locate = (id: AdapterId): void => {
    void pick().then((path) => {
      if (path === null) return
      setAdapter(id, { ...draft.adapters?.[id], path })
      void probe().then(setProbes)
    })
  }

  return (
    <div style={sectionStyle}>
      <style>{'@keyframes dsh-ea-shimmer { 0% { background-position: 100% 0 } 100% { background-position: 0 0 } }'}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <h2 style={{ ...titleStyle, flex: 1 }}>{t('title')}</h2>
        <button
          type='button'
          onClick={() => {
            setProbing(true)
            void probe(false).then((fresh) => {
              setProbes(fresh)
              setProbing(false)
            }).catch((cause: unknown) => {
              setError(String(cause))
              setProbing(false)
            })
          }}
          style={{
            height: 32,
            padding: '0 12px',
            border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: 24,
            background: 'transparent',
            color: 'inherit',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {t('refresh')}
        </button>
      </div>
      <p style={introStyle}>{t('sectionIntro')}</p>
      {probing || snapshot === undefined ? (
        <ul style={cardsStyle}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </ul>
      ) : (
        <ul style={cardsStyle}>
          {snapshot.catalog.map((card) => (
            <AdapterCard
              key={card.id}
              card={card}
              row={draft.adapters?.[card.id] ?? {}}
              probe={probes[card.id]}
              inUse={draft.defaultAdapter === card.id && draft.adapters?.[card.id]?.enabled === true}
              t={t}
              onPickDefault={() => persist({ ...draft, defaultAdapter: card.id })}
              onChange={(row) => setAdapter(card.id, row)}
              onLocate={() => locate(card.id)}
            />
          ))}
        </ul>
      )}
      {error !== undefined ? <p style={{ ...introStyle, color: 'var(--dsw-alias-state-error-primary)' }} role='alert'>{error}</p> : null}
    </div>
  )
}
