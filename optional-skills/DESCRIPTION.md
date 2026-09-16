# Optional Skills

Official skills maintained by Umbriel that are **not activated by default**.

These skills ship with the umbriel-brain repository but are not copied to
`~/.umbriel/skills/` during setup. They are discoverable via the Skills Hub:

```bash
umbriel skills browse               # browse all skills, official shown first
umbriel skills browse --source official  # browse only official optional skills
umbriel skills search <query>       # finds optional skills labeled "official"
umbriel skills install <identifier> # copies to ~/.umbriel/skills/ and activates
```

## Why optional?

Some skills are useful but not broadly needed by every user:

- **Niche integrations** — specific paid services, specialized tools
- **Experimental features** — promising but not yet proven
- **Heavyweight dependencies** — require significant setup (API keys, installs)

By keeping them optional, we keep the default skill set lean while still
providing curated, tested, official skills for users who want them.
