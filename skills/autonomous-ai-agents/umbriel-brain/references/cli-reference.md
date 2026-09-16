# Umbriel CLI Reference

Live sources when anything looks stale: `umbriel --help`, `umbriel <command> --help`,
https://umbriel-brain.nousresearch.com/docs/reference/cli-commands

### Global Flags

```
umbriel [flags] [command]        (no subcommand = interactive chat)

  --version, -V             Show version
  -z, --oneshot PROMPT      One-shot: print ONLY the final response (for scripts/pipes)
  -m MODEL  --provider P    Model/provider override for this invocation
  -t, --toolsets LIST       Comma-separated toolsets for this invocation
  --resume, -r SESSION      Resume session by ID or title
  --continue, -c [NAME]     Resume by name, or most recent session
  --worktree, -w            Isolated git worktree mode (parallel agents)
  --skills, -s SKILL        Preload skills (comma-separate or repeat)
  --profile, -p NAME        Use a named profile
  --yolo                    Skip dangerous command approval
  --tui / --cli             Force the Ink TUI / classic REPL
  --ignore-rules            Skip AGENTS.md/SOUL.md/memory/skill injection
  --safe-mode               Disable ALL customizations (troubleshooting)
  --pass-session-id         Include session ID in system prompt
```

### Chat

```
umbriel chat [flags]
  -q, --query TEXT          Single query, non-interactive
  --image PATH              Attach a local image to a single query
  -Q, --quiet               Suppress banner, spinner, tool previews
  --checkpoints             Enable filesystem checkpoints (/rollback)
  --max-turns N             Cap tool-calling iterations
  --source TAG              Session source tag (default: cli)
```
(plus the global flags above)

### Configuration

```
umbriel setup [section]      Wizard (model|tts|terminal|gateway|tools|agent)
umbriel model                Interactive model/provider picker
umbriel fallback [add|remove|list]  Fallback provider chain
umbriel config [show|edit|get|set|unset|path|env-path|check|migrate]
umbriel login / logout       OAuth sign-in / clear stored auth
umbriel doctor [--fix]       Check dependencies and config
umbriel status [--all]       Component status
```

### Tools & Skills

```
umbriel tools [list|enable NAME|disable NAME]   Per-platform toolsets (curses UI with no args)

umbriel skills list|browse|search QUERY|inspect ID
umbriel skills install ID    Hub identifier OR a direct https://…/SKILL.md URL
umbriel skills config        Enable/disable skills per platform
umbriel skills check|update|uninstall|publish PATH
umbriel skills tap add REPO  Add a GitHub repo as a skill source
umbriel bundles              Skill bundles (one /<name> alias loads several skills)
```

### MCP Servers

```
umbriel mcp add NAME (--url or --command) | remove | list | test NAME
umbriel mcp catalog | install NAME     Curated catalog install
umbriel mcp configure NAME             Toggle tool selection
umbriel mcp serve                      Run Umbriel as an MCP server
```
Details (transport, tool discovery, catalog): `references/native-mcp.md`.

### Gateway (Messaging Platforms)

```
umbriel gateway run|install|start|stop|restart|status|setup
```

20+ platforms: Telegram, Discord, Slack, WhatsApp (Baileys + Business Cloud API), iMessage (Photon — `umbriel photon setup`), Signal, Email, SMS, Matrix, Mattermost, Teams, LINE, SimpleX, ntfy, Google Chat, Home Assistant, DingTalk, Feishu, WeCom, Weixin, API Server, Webhooks. Open WebUI connects via the API Server adapter. Most adapters ship under `plugins/platforms/`.
Docs: https://umbriel-brain.nousresearch.com/docs/user-guide/messaging/

### Sessions

```
umbriel sessions list|browse|rename ID TITLE|delete ID|export OUT|prune|stats
```

### Cron / Webhooks

```
umbriel cron list|create SCHED|edit ID|pause|resume|run ID|remove|status
    Schedules: '30m', 'every 2h', '0 9 * * *', ISO timestamp
umbriel webhook subscribe NAME|list|remove NAME|test NAME
```
Webhook payloads/routes: `references/webhooks.md`.

### Profiles

```
umbriel profile list|create NAME (--clone|--clone-all|--clone-from)|use|show|delete
umbriel profile rename A B | alias NAME | export NAME | import FILE
```

### Credentials & Pools

```
umbriel auth                 Interactive credential manager
umbriel auth add [PROVIDER]  Add OAuth or API-key credential (nous, openai-codex, qwen-oauth, …)
umbriel auth list|remove P IDX|reset PROVIDER|status
```
Multiple credentials per provider form a pool that rotates automatically and skips exhausted keys.

### Other

```
umbriel desktop / gui        Native desktop app
umbriel dashboard            Web admin panel + embedded chat (--stop / --status)
umbriel proxy                OpenAI-compatible local proxy backed by an OAuth provider
umbriel portal               Quick setup / sign in via Nous Portal
umbriel kanban <verb>        Multi-agent work-queue board
umbriel project              Named multi-folder workspaces
umbriel skin list|use|set    Switch/tweak skins (see references/themes.md)
umbriel pets <verb>          Pet mascots (see references/petdex.md)
umbriel memory setup|status|off|reset   Memory provider
umbriel secrets bitwarden|onepassword   External secret stores
umbriel moa                  Mixture-of-Agents slots
umbriel hooks / security / backup / import / checkpoints / console
umbriel logs [-f] [errors]   View agent/error logs
umbriel send                 One-off message through a gateway platform
umbriel pairing / plugins / insights / journey / computer-use
umbriel acp                  ACP server (IDE integration)
umbriel completion bash|zsh|fish
umbriel update / uninstall / claw migrate
```

Plugin- and provider-supplied subcommands (e.g. `umbriel photon setup`) only appear once their plugin is installed/active.

### Where to Find Things

| Looking for... | Location |
|---|---|
| Config options | `umbriel config edit` · [Configuration docs](https://umbriel-brain.nousresearch.com/docs/user-guide/configuration) |
| Tools / toolsets | `umbriel tools list` · [Tools reference](https://umbriel-brain.nousresearch.com/docs/reference/tools-reference) |
| Skills catalog | `umbriel skills browse` · [Skills catalog](https://umbriel-brain.nousresearch.com/docs/reference/skills-catalog) |
| Provider setup | `umbriel model` · [Providers guide](https://umbriel-brain.nousresearch.com/docs/integrations/providers) |
| Env variables | `umbriel config env-path` · [Env vars reference](https://umbriel-brain.nousresearch.com/docs/reference/environment-variables) |
| Gateway logs | `~/.umbriel/logs/gateway.log` (or `umbriel logs`) |
| Sessions | `umbriel sessions browse` (reads state.db) |
