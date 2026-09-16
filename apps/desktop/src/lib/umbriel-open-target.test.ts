import { describe, expect, it } from 'vitest'

import {
  normalizeUmbrielOpenString,
  pathFromUmbrielDeepLink,
  pathFromOpenDeepLink,
  resolveUmbrielOpenPath
} from './umbriel-open-target'

describe('normalizeUmbrielOpenString', () => {
  it('accepts hash-router paths and strips a leading hash', () => {
    expect(normalizeUmbrielOpenString('/index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeUmbrielOpenString('#/index-network/intent/1')).toBe('/index-network/intent/1')
  })

  it('maps plugin-scoped umbriel:// deep links to the same path', () => {
    expect(normalizeUmbrielOpenString('umbriel://index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeUmbrielOpenString('umbriel://index-network/intent/1?focus=true')).toBe(
      '/index-network/intent/1?focus=true'
    )
  })

  it('maps umbriel://open/… deep links by stripping the open host', () => {
    expect(normalizeUmbrielOpenString('umbriel://open/index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeUmbrielOpenString('umbriel://open/settings/plugins')).toBe('/settings/plugins')
  })

  it('rejects reserved umbriel kinds and unsafe paths', () => {
    expect(normalizeUmbrielOpenString('umbriel://blueprint/morning-brief')).toBeNull()
    expect(normalizeUmbrielOpenString('umbriel://plugin/install')).toBeNull()
    expect(normalizeUmbrielOpenString('https://example.com/x')).toBeNull()
    expect(normalizeUmbrielOpenString('/../etc/passwd')).toBeNull()
    expect(normalizeUmbrielOpenString('index-network')).toBeNull()
  })
})

describe('resolveUmbrielOpenPath', () => {
  it('merges structured path + params', () => {
    expect(resolveUmbrielOpenPath({ path: '/index-network/intent/1', params: { focus: 'true' } })).toBe(
      '/index-network/intent/1?focus=true'
    )
  })

  it('resolves href the same as a bare string', () => {
    expect(resolveUmbrielOpenPath({ href: 'umbriel://index-network/intent/1' })).toBe('/index-network/intent/1')
  })
})

describe('pathFromUmbrielDeepLink', () => {
  it('builds the navigate path from a plugin-scoped deep-link payload', () => {
    expect(pathFromUmbrielDeepLink('index-network', 'intent/1')).toBe('/index-network/intent/1')
  })

  it('builds the navigate path from umbriel://open/… payloads', () => {
    expect(pathFromOpenDeepLink('index-network/intent/1')).toBe('/index-network/intent/1')
    expect(pathFromUmbrielDeepLink('open', 'agent/42')).toBe('/agent/42')
  })

  it('ignores reserved kinds', () => {
    expect(pathFromUmbrielDeepLink('blueprint', 'morning-brief')).toBeNull()
    expect(pathFromUmbrielDeepLink('plugin', 'install')).toBeNull()
  })
})
