# Claude Code skills pack — UI/UX + Development

All folders here are formatted as **Claude Code skills** (valid YAML `name`/`description`,
name matches folder). No credentials, sessions, or API keys included.

## Install (on the other PC)
Copy the contents of `skills/` into the target machine's Claude skills folder:

- Windows: `C:\Users\<name>\.claude\skills\`
- macOS/Linux: `~/.claude/skills/`

So you end up with e.g. `~/.claude/skills/ui-ux-pro-max/`, `~/.claude/skills/code-flow-graph/`, etc.
Restart Claude Code (or start a new session) and run `/` to confirm they appear.

## Skills
- `ui-ux-pro-max`   — UI/UX design intelligence
- `code-flow-graph` — interactive code/UI flow graph diagrams ("code review graph")
- `code-dev`        — coding workflow
- `dev`             — full-stack web dev assistant
- `super-dev`       — extended dev workflow
- `explain-code`    — code explanation
- `openclaw-code`   — plan/implement/verify/test coding workflow
- `coding-agent`    — coding agent skill
- `github`          — GitHub operations

## Notes
These were ported from OpenClaw. A few reference OpenClaw tool names (`exec`, `write`)
in their prompt text — in Claude Code the equivalents are `Bash` and `Write`. They still
work as guidance; no edits required to load them.
