# Umbriel Desktop ☤

<p align="center">
  <a href="https://github.com/embreythecreator/umbriel-brain/releases"><img src="https://img.shields.io/badge/Download-macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-FFD700?style=for-the-badge" alt="Download"></a>
  <a href="https://umbriel-brain.embreythecreator.com/docs/"><img src="https://img.shields.io/badge/Docs-umbriel--agent.embreythecreator.com-FFD700?style=for-the-badge" alt="Documentation"></a>
  <a href="https://discord.gg/embreythecreator"><img src="https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://github.com/embreythecreator/umbriel-brain/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License: MIT"></a>
</p>

**The native desktop app for [Umbriel Brain](../../README.md) — the self-improving AI agent from [Umbriel](https://embreythecreator.com).** Same agent, same skills, same memory as the CLI and gateway, in a polished native window — chat with streaming tool output, side-by-side previews, a file browser, voice, and settings, no terminal required. Available for **macOS, Windows, and Linux**.

<table>
<tr><td><b>Chat with the full agent</b></td><td>Streaming responses, live tool activity, structured tool summaries, and the same conversation history as every other Umbriel surface.</td></tr>
<tr><td><b>Side-by-side previews</b></td><td>Render web pages, files, and tool outputs in a right-hand pane while you keep chatting.</td></tr>
<tr><td><b>File browser</b></td><td>Explore and preview the working directory without leaving the app.</td></tr>
<tr><td><b>Voice</b></td><td>Talk to Umbriel and hear it back.</td></tr>
<tr><td><b>Settings & onboarding</b></td><td>Manage providers, models, tools, and credentials from a real UI. First-run setup gets you to your first message in seconds.</td></tr>
<tr><td><b>Stays current</b></td><td>Built-in updates pull the latest agent and rebuild the app in place.</td></tr>
</table>

---

## Install

### Install with Umbriel (recommended)

Already have the Umbriel CLI? Just run:

```bash
umbriel desktop
```

It builds and launches the GUI against your existing install — same config, keys, sessions, and skills. If Desktop cannot find a usable runtime or saved remote connection, first launch lets you connect to an existing Umbriel gateway or install Umbriel locally. Local onboarding then walks you through choosing a provider and model.

### Prebuilt installers

Prebuilt installers are built and distributed via [the Umbriel Desktop website.](https://umbriel-brain.embreythecreator.com/).

---

## Updating

The app checks for updates in the background and offers a one-click update when one is ready. You can also update any time from the CLI:

```bash
umbriel update
```

---

## Requirements

The installer handles everything for you (Python 3.11+, a portable Git, ripgrep).

---

## Development

Want to hack on the app itself? Install workspace deps from the repo root once, then run the dev server from this directory:

```bash
npm install          # from repo root — links apps/desktop, web, apps/shared
cd apps/desktop
npm run dev          # Vite renderer + Electron, which boots the Python backend
```

Point the app at a specific source checkout, or sandbox it away from your real config:

```bash
# throwaway UMBRIEL_HOME, separate Electron userData, distinct app name to avoid the single-instance lock
../scripts/dev-sandbox.sh npm run dev
UMBRIEL_DESKTOP_UMBRIEL_ROOT=/path/to/clone npm run dev
UMBRIEL_HOME=/tmp/throwaway npm run dev
npm run dev:fake-boot   # exercise the startup overlay with deterministic delays
```

### Building installers

```bash
npm run dist:mac     # DMG + zip
npm run dist:win     # NSIS + MSI
npm run dist:linux   # AppImage + deb + rpm
npm run pack         # unpacked app under release/ (no installer)
```

Installers are built and uploaded to GitHub Releases manually. macOS/Windows signing & notarization happen automatically when the relevant credentials are present in the environment (`CSC_LINK` / `CSC_KEY_PASSWORD` / `APPLE_*` for macOS, `WIN_CSC_*` for Windows).

### How it works

The packaged app ships the Electron shell and a native React chat surface. On
first launch it can install the Umbriel Brain runtime into `UMBRIEL_HOME`
(`~/.umbriel`, or `%LOCALAPPDATA%\umbriel` on Windows), using the same layout as a
CLI install.

The app has three boundaries:

- **Electron** resolves and validates a runnable backend, owns native
  filesystem/git/window capabilities, and exposes a narrow preload bridge.
- **React** owns the Desktop routes, panes, interaction state, and
  `@assistant-ui/react` transcript.
- **Umbriel Brain** runs as a headless `umbriel serve` process and exposes the
  `tui_gateway` JSON-RPC/WebSocket API. The renderer connects through
  [`apps/shared`](../shared/), which is also used by the browser dashboard.

Backend resolution is an ordered ladder:

1. `UMBRIEL_DESKTOP_UMBRIEL_ROOT`
2. the current source checkout during development
3. a completed managed install
4. `UMBRIEL_DESKTOP_UMBRIEL`, or `umbriel` on `PATH`
5. a system Python that can import the Umbriel runtime
6. the first-launch bootstrap installer

Candidates are probed before use; an existing shim or interpreter is not enough.
A runtime that predates `serve` falls back to headless
`dashboard --no-open`. This is compatibility for the backend command only and
does not launch or embed the dashboard UI.

The Electron orchestration entry point is `electron/main.ts`; pure resolution,
probe, hardening, and platform policies live in focused modules beside it. The
renderer is under `src/`, with shared atoms in `src/store` and transport/native
adapters in `src/lib`.

Before changing the app, read:

- [`AGENTS.md`](./AGENTS.md): architecture, state ownership, resolver/fallback,
  transport, performance, and testing rules.
- [`DESIGN.md`](./DESIGN.md): visual system, information architecture, motion,
  direct manipulation, and keyboard behavior.

### Connections, projects, and switching

Desktop supports a managed local backend, explicit remote gateways, and Umbriel
Cloud connections. Remote and cloud modes use the same remote-capability path;
authentication and discovery differ, not the renderer feature model.

When no usable local runtime or saved remote connection exists, the first-run
screen offers **Connect to existing Umbriel** before starting the local installer.
Desktop probes the gateway to discover token or OAuth authentication, requires a
successful HTTP and WebSocket connection test, and saves the connection using
the same encrypted Desktop configuration used by Settings. A saved remote
connection bypasses this choice on later launches. The regular Desktop build
still includes the local-install option; this is a remote operating mode, not a
separate client-only application.

In remote mode the gateway host is the execution boundary: agent tools,
terminal commands, and file operations run against the remote Umbriel host, not
the computer displaying the Desktop UI.

Remote gateways that sit behind an access proxy may require extra headers on
every HTTP and WebSocket request. Configure them per connection in Settings →
Connections (Extra gateway headers), or add a `headers` object to Desktop's
Electron `userData/connection.json` remote block:

```json
{
  "mode": "remote",
  "remote": {
    "url": "https://umbriel.example.com",
    "authMode": "token",
    "token": { "encoding": "safeStorage", "value": "..." },
    "headers": {
      "CF-Access-Client-Id": { "encoding": "safeStorage", "value": "..." },
      "CF-Access-Client-Secret": { "encoding": "safeStorage", "value": "..." }
    }
  }
}
```

Per-profile remote entries under `profiles[name].headers` use the same shape.
Desktop applies these headers only to matching remote gateway requests, treats
`https` and `wss` as the same gateway origin for WebSocket upgrades, and drops
transport- or Umbriel-managed header names such as `Authorization`, `Cookie`,
`Host`, `Origin`, `Referer`, and `X-Umbriel-Session-Token`.

Projects are the workspace abstraction. A project may own multiple folders,
repositories, worktrees, and sessions; a bare new chat remains detached unless
the user enters a project or configures a default project directory. Use the
Projects UI rather than adding a second per-session folder-picker workflow.

Changing profiles or connection modes is a soft workspace switch, not another
cold boot. The shell and current management overlay remain mounted while
gateway-bound nanostores are wiped, query-backed data is invalidated, and the
new connection repopulates skeletons. This prevents rows or transcripts from
the previous gateway bleeding into the next one. Switching changes only the
foreground view and request route: it does not cancel turns or stop a backend,
and retained background sockets continue receiving events from running jobs.

### Verification

Run before opening a PR (lint may surface pre-existing warnings but must exit cleanly):

```bash
npm run fix
npm run typecheck
npm run lint
npm run test:ui
npm run test:desktop:platforms
```

Run `npm run test:desktop:all` for install, boot, update, packaging, or other
release-path changes.

### Troubleshooting

Boot logs land in `UMBRIEL_HOME/logs/desktop.log` (includes backend output and recent Python tracebacks) — check it first if the app reports a boot failure.

**macOS / Linux:**

```bash
# Force a clean first-launch setup
rm "$HOME/.umbriel/umbriel-brain/.umbriel-bootstrap-complete"
# Rebuild a broken Python venv
rm -rf "$HOME/.umbriel/umbriel-brain/venv"
# Reset a stuck macOS microphone prompt (macOS only)
tccutil reset Microphone com.embreythecreator.umbriel
```

**Windows (PowerShell):**

```powershell
# Force a clean first-launch setup
Remove-Item "$env:LOCALAPPDATA\umbriel\umbriel-brain\.umbriel-bootstrap-complete"
# Rebuild a broken Python venv
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\umbriel\umbriel-brain\venv"
```

> The default Umbriel home on Windows is `%LOCALAPPDATA%\umbriel`. Set the `UMBRIEL_HOME` env var if you've relocated it.

---

## Community

- 💬 [Discord](https://discord.gg/embreythecreator)
- 📖 [Documentation](https://umbriel-brain.embreythecreator.com/docs/)
- 🐛 [Issues](https://github.com/embreythecreator/umbriel-brain/issues)

---

## License

MIT — see [LICENSE](../../LICENSE).

Built by [Umbriel](https://embreythecreator.com).
