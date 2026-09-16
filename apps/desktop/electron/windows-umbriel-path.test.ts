// Unit tests for the pure Windows `umbriel` resolution helpers extracted from
// main.ts's findOnPath(), handOffWindowsBootstrapRecovery(), and
// unwrapWindowsVenvUmbrielCommand(). These pin the two Windows resolution bugs
// that caused desktop reinstall loops:
//   1. buildPathExtCandidates() — PATHEXT extensions must be tried BEFORE the
//      empty extension, or an extensionless Git-Bash `umbriel` shim shadows
//      the real umbriel.cmd/umbriel.exe.
//   2. chooseUpdaterArgs() — must distinguish a runnable updater from stale
//      install provenance. The bootstrap marker can outlive the venv, and a
//      partial venv cannot run the updater; those states require --repair.
//   3. resolveVenvUmbrielCommand() — must probe the venv python via
//      canImportUmbrielCli() before trusting it, or a broken venv gets
//      re-selected forever instead of falling through to bootstrap.

import assert from 'node:assert/strict'
import path from 'node:path'

import { test } from 'vitest'

import {
  buildPathExtCandidates,
  chooseUpdaterArgs,
  getVenvSitePackagesEntries,
  resolveVenvUmbrielCommand
} from './windows-umbriel-path'

test('buildPathExtCandidates: Windows tries PATHEXT extensions before the empty extension', () => {
  const extensions = buildPathExtCandidates('.COM;.EXE;.BAT;.CMD', true)

  assert.deepEqual(extensions, ['.COM', '.EXE', '.BAT', '.CMD', ''])
  assert.equal(extensions[extensions.length - 1], '', 'empty extension must be last, not first')
  assert.notEqual(extensions[0], '', 'the buggy empty-extension-first order must not return')
})

test('buildPathExtCandidates: defaults to .COM;.EXE;.BAT;.CMD when PATHEXT is unset on Windows', () => {
  assert.deepEqual(buildPathExtCandidates(undefined, true), ['.COM', '.EXE', '.BAT', '.CMD', ''])
})

test('buildPathExtCandidates: respects a custom PATHEXT, still empty-last', () => {
  assert.deepEqual(buildPathExtCandidates('.EXE;.PS1', true), ['.EXE', '.PS1', ''])
})

test('buildPathExtCandidates: non-Windows only tries the bare name', () => {
  assert.deepEqual(buildPathExtCandidates('.COM;.EXE;.BAT;.CMD', false), [''])
  assert.deepEqual(buildPathExtCandidates(undefined, false), [''])
})

test('chooseUpdaterArgs: gentle --update when both updater runtime files exist', () => {
  assert.deepEqual(chooseUpdaterArgs({ hasBootstrapMarker: true, hasVenvUmbriel: true, hasVenvPython: true }, 'main'), [
    '--update',
    '--branch',
    'main'
  ])
})

test('chooseUpdaterArgs: marker-only install uses --repair when the venv is gone', () => {
  assert.deepEqual(
    chooseUpdaterArgs({ hasBootstrapMarker: true, hasVenvUmbriel: false, hasVenvPython: false }, 'main'),
    ['--repair', '--branch', 'main']
  )
})

test('chooseUpdaterArgs: partial updater runtimes use --repair', () => {
  assert.deepEqual(chooseUpdaterArgs({ hasBootstrapMarker: true, hasVenvUmbriel: false, hasVenvPython: true }, 'main'), [
    '--repair',
    '--branch',
    'main'
  ])
  assert.deepEqual(chooseUpdaterArgs({ hasBootstrapMarker: true, hasVenvUmbriel: true, hasVenvPython: false }, 'main'), [
    '--repair',
    '--branch',
    'main'
  ])
})

test('chooseUpdaterArgs: passes the branch through unchanged in both modes', () => {
  assert.deepEqual(
    chooseUpdaterArgs({ hasBootstrapMarker: false, hasVenvUmbriel: true, hasVenvPython: true }, 'release/1.2'),
    ['--update', '--branch', 'release/1.2']
  )
  assert.deepEqual(
    chooseUpdaterArgs({ hasBootstrapMarker: false, hasVenvUmbriel: false, hasVenvPython: false }, 'release/1.2'),
    ['--repair', '--branch', 'release/1.2']
  )
})

function makeDeps(overrides: Partial<Parameters<typeof resolveVenvUmbrielCommand>[2]> = {}) {
  return {
    isWindows: true,
    isCommandScript: () => false,
    fileExists: () => true,
    directoryExists: () => false,
    canImportUmbrielCli: () => true,
    getVenvPython: (venvRoot: string) => `${venvRoot}/Scripts/python.exe`,
    getVenvSitePackagesEntries: () => [],
    buildDesktopBackendEnv: () => ({ FAKE_ENV: '1' }),
    umbrielHome: '/fake/umbriel-home',
    resolvePath: (...segments: string[]) => segments.join('/').replace(/\/+/g, '/'),
    dirname: (p: string) => p.slice(0, p.lastIndexOf('/')) || '/',
    basename: (p: string) => p.slice(p.lastIndexOf('/') + 1),
    rememberLog: () => {},
    ...overrides
  }
}

test('resolveVenvUmbrielCommand: returns null off Windows', () => {
  const deps = makeDeps({ isWindows: false })

  assert.equal(resolveVenvUmbrielCommand('/root/venv/Scripts/umbriel.exe', [], deps), null)
})

test('resolveVenvUmbrielCommand: returns null for a .cmd/.bat script command', () => {
  const deps = makeDeps({ isCommandScript: () => true })

  assert.equal(resolveVenvUmbrielCommand('/root/venv/Scripts/umbriel.cmd', [], deps), null)
})

test('resolveVenvUmbrielCommand: returns null when the basename is not umbriel/umbriel.exe', () => {
  const deps = makeDeps()

  assert.equal(resolveVenvUmbrielCommand('/root/venv/Scripts/python.exe', [], deps), null)
})

test('resolveVenvUmbrielCommand: returns null when the parent dir is not Scripts', () => {
  const deps = makeDeps()

  assert.equal(resolveVenvUmbrielCommand('/root/venv/bin/umbriel.exe', [], deps), null)
})

test('resolveVenvUmbrielCommand: returns null when the venv python does not exist on disk', () => {
  const deps = makeDeps({ fileExists: () => false })

  assert.equal(resolveVenvUmbrielCommand('/root/venv/Scripts/umbriel.exe', [], deps), null)
})

test('resolveVenvUmbrielCommand: probes the venv python before trusting it (returns null on failed probe)', () => {
  let probed = false

  const deps = makeDeps({
    canImportUmbrielCli: (python: string) => {
      probed = true
      assert.equal(python, '/root/venv/Scripts/python.exe')

      return false
    }
  })

  const result = resolveVenvUmbrielCommand('/root/venv/Scripts/umbriel.exe', ['serve'], deps)

  assert.equal(probed, true, 'must probe the venv interpreter; a broken venv must not be re-selected forever')
  assert.equal(result, null, 'a failed probe must fall through (return null) so the resolver reaches bootstrap')
})

test('resolveVenvUmbrielCommand: returns the resolved python backend descriptor when the probe passes', () => {
  const deps = makeDeps()
  const result = resolveVenvUmbrielCommand('/root/venv/Scripts/umbriel.exe', ['serve', '--port', '0'], deps)

  assert.ok(result, 'a passing probe must return a backend descriptor, not null')
  assert.equal(result.command, '/root/venv/Scripts/python.exe')
  assert.deepEqual(result.args, ['-m', 'umbriel_cli.main', 'serve', '--port', '0'])
  assert.equal(result.bootstrap, false)
  assert.equal(result.kind, 'python')
  assert.equal(result.shell, false)
  assert.deepEqual(result.env, { FAKE_ENV: '1' })
})

test('resolveVenvUmbrielCommand: is case-insensitive on umbriel.exe and the Scripts dir name', () => {
  const deps = makeDeps()

  assert.ok(resolveVenvUmbrielCommand('/root/venv/Scripts/UMBRIEL.EXE', [], deps))
  assert.ok(resolveVenvUmbrielCommand('/root/venv/SCRIPTS/umbriel.exe', [], deps))
})

// ── getVenvSitePackagesEntries ─────────────────────────────────────────────

test('getVenvSitePackagesEntries: returns Lib/site-packages on Windows when it exists', () => {
  const expected = path.join('C:\\venv', 'Lib', 'site-packages')

  const result = getVenvSitePackagesEntries('C:\\venv', {
    isWindows: true,
    directoryExists: p => p === expected
  })

  assert.deepEqual(result, [expected])
})

test('getVenvSitePackagesEntries: returns empty on Windows when site-packages does not exist', () => {
  const result = getVenvSitePackagesEntries('C:\\venv', {
    isWindows: true,
    directoryExists: () => false
  })

  assert.deepEqual(result, [])
})

test('getVenvSitePackagesEntries: reads pyvenv.cfg version on POSIX and resolves lib/pythonX.Y/site-packages', () => {
  const result = getVenvSitePackagesEntries('/venv', {
    isWindows: false,
    directoryExists: p => p === '/venv/lib/python3.12/site-packages',
    readFile: () => 'version_info = 3.12.1\n'
  })

  assert.deepEqual(result, ['/venv/lib/python3.12/site-packages'])
})

test('getVenvSitePackagesEntries: returns empty on POSIX when pyvenv.cfg is missing', () => {
  const result = getVenvSitePackagesEntries('/venv', {
    isWindows: false,
    directoryExists: () => true,
    readFile: () => undefined
  })

  assert.deepEqual(result, [])
})

test('getVenvSitePackagesEntries: returns empty on POSIX when pyvenv.cfg has no version_info', () => {
  const result = getVenvSitePackagesEntries('/venv', {
    isWindows: false,
    directoryExists: () => true,
    readFile: () => 'home = /usr/bin\n'
  })

  assert.deepEqual(result, [])
})

test('getVenvSitePackagesEntries: returns empty on POSIX when version is present but site-packages dir is absent', () => {
  const result = getVenvSitePackagesEntries('/venv', {
    isWindows: false,
    directoryExists: () => false,
    readFile: () => 'version_info = 3.11\n'
  })

  assert.deepEqual(result, [])
})

test('getVenvSitePackagesEntries: returns empty for a falsy venvRoot', () => {
  assert.deepEqual(getVenvSitePackagesEntries('', { isWindows: true, directoryExists: () => true }), [])
  assert.deepEqual(getVenvSitePackagesEntries(null, { isWindows: true, directoryExists: () => true }), [])
  assert.deepEqual(getVenvSitePackagesEntries(undefined, { isWindows: true, directoryExists: () => true }), [])
})
