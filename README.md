<div align="center">

<img src="brand/png/cf-icon-512.png" width="104" alt="Code Feedback" />

# Code Feedback

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/khanakia.code-feedback?label=Marketplace&logo=visualstudiocode&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=khanakia.code-feedback)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/khanakia.code-feedback?label=installs&color=4c1)](https://marketplace.visualstudio.com/items?itemName=khanakia.code-feedback)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/khanakia.code-feedback?label=downloads&color=4c1)](https://marketplace.visualstudio.com/items?itemName=khanakia.code-feedback)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/khanakia.code-feedback?label=rating)](https://marketplace.visualstudio.com/items?itemName=khanakia.code-feedback&ssr=false#review-details)
[![Open VSX](https://img.shields.io/open-vsx/v/khanakia/code-feedback?label=Open%20VSX&color=a60ee5)](https://open-vsx.org/extension/khanakia/code-feedback)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/khanakia/code-feedback?label=OVSX%20downloads)](https://open-vsx.org/extension/khanakia/code-feedback)
[![CI](https://github.com/thesatellite-ai/vscode-code-feedback/actions/workflows/ci.yml/badge.svg)](https://github.com/thesatellite-ai/vscode-code-feedback/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/tag/thesatellite-ai/vscode-code-feedback?sort=semver&label=release)](https://github.com/thesatellite-ai/vscode-code-feedback/tags)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.75-007ACC?logo=visualstudiocode&logoColor=white)
![Cursor](https://img.shields.io/badge/Cursor-compatible-000?logo=cursor&logoColor=white)
![Zero deps](https://img.shields.io/badge/runtime%20deps-0-success)

**Leave review-comment notes on code lines, track them as Open/Resolved, then copy the open ones as one clean markdown list — `file:line` + comment + snippet — to paste straight into Claude Code, Cursor, or Copilot.**

</div>

Code Feedback turns the loop of "review code → jot what's wrong → hand it to an AI" into something native to your editor. Select lines, write a note (with `#tags`), and it lands in a sidebar that works like local PR review comments. When you're ready, one shortcut copies every open note straight to your clipboard. No files are modified — notes live outside your code, persisted per project, and survive reloads and restarts.

## Why

You're reviewing a PR, reading an unfamiliar codebase, or scoping a refactor, and you keep spotting things — a bug here, a naming nit there, "this needs a test," "handle the empty case." **Capturing that feedback is the annoying part:**

- Scatter `// TODO` / `// FIXME` comments and you pollute the source, churn the diff, and have to hunt them all down to remove later.
- Keep it in your head and you forget half of it by the time you're done reading.
- Alt-tab to a notes app and you lose the one thing that matters — *which file, which line.*
- Then, to hand the list to an AI agent, you **retype every location by hand.**

Code Feedback collapses that whole loop. Mark lines in place (zero edits to your code), and each note is captured with the exact `file:line` and the code snippet. Keep going across files — the list grows in a sidebar. One shortcut (`Cmd/Ctrl+Alt+C`) copies every **open** note as clean markdown your agent can act on directly. As the agent fixes things, click **✓** to resolve them — they drop out of the next copy, so you always send only what's left. It's PR-review comments for your own workflow, built for the hand-off to an AI.

```text
You, reading code:                          One keystroke later, in your agent:
  ┌─ src/pay.go:42 ── ● needs idempotency      ## Feedback notes
  │  ┌─ web/cart.tsx:88 ─ ● empty-cart crash    1. `src/pay.go:42-45`  #bug
  │  │  ┌─ api/auth.ts:12 ─ ● spoofable header     > needs idempotency key
  └──┴──┴───────────────────────────────►       2. `web/cart.tsx:88`
        select · note · #tag · resolve             > empty-cart case crashes …
```

## Features

- **Note on any selection** — `Cmd/Ctrl+Alt+N` captures the file path, line range, and code snippet.
- **Open / Resolved tracking** — resolve notes as the agent fixes them; they collapse into a Resolved group and drop out of the next copy.
- **Inline live filter** — a search box in the panel narrows as you type; match text or `#tags`, with tag autocomplete.
- **Tag chips** — every tag in the project shows as a clickable chip to toggle as a filter.
- **This file only** — one toggle scopes the list to the file you're viewing, and follows you across tabs.
- **In-editor markers** — every noted line gets a gutter dot, a highlight, and an overview-ruler tick (yellow = open, grey = resolved), with the note on hover.
- **Copy for your agent** — open notes (or all, with resolved marked) formatted as a markdown list. Click a note to jump back and select the lines.
- **Across projects** — Preview All gathers notes from every project into one read-only doc.

## Workflow

1. Select one or more lines (or just place the cursor on a line).
2. Right-click → **Code Feedback: Add Note from Selection** (or press `Cmd/Ctrl+Alt+N`).
3. Type your feedback. Add tags inline with `#` — e.g. `broken auth #bug #api`. It lands in the **Code Feedback** panel under **Open**.
4. Repeat across as many files as you want — the list keeps growing.
5. Press `Cmd/Ctrl+Alt+C` (or the copy icon in the panel title) to copy all open notes.
6. Paste into your AI agent.
7. As things get fixed, hover a note and click **✓** to resolve it — it moves to the Resolved group and drops out of the next copy.

## The sidebar

A live **filter box** at the top, a **This file only** toggle, a row of **tag chips**, then notes grouped into collapsible **Open** and **Resolved** sections.

- **Filter** — type to narrow. Words match file path / note / snippet; `#tag` tokens filter by tag (e.g. `auth #bug`). Typing `#` shows an autocomplete dropdown of your existing tags.
- **Tag chips** — click a tag to filter by it (highlighted when active); click again to release.
- **This file only** — scopes the list to the active editor's file and updates as you switch tabs.
- **Per note** (on hover): **✓ resolve** / **↺ reopen**, **edit** (text + tags), **delete**. Click the note body to reveal and select the lines.

Title bar: **Copy Open Notes**, **Preview All Notes**, and an overflow `…` with **Copy All incl. Resolved**, **Clear Resolved**, **Clear All (this project)**, and **Clear All (all projects)**. Destructive actions ask first.

## What gets copied

```markdown
## Feedback notes

1. `api/pay.go:42-45`  #bug #api
   > needs idempotency key — duplicate charges possible

   ```go
   func Pay(ctx context.Context) error {
       charge(ctx)
   }
   ```

2. `web/cart.tsx:88`
   > empty-cart case not handled, crashes

   ```tsx
   const total = items.reduce(...)
   ```
```

## Keybindings

| Action | macOS | Windows / Linux |
|---|---|---|
| Add note from selection | `Cmd+Alt+N` | `Ctrl+Alt+N` |
| Copy open notes | `Cmd+Alt+C` | `Ctrl+Alt+C` |

Rebind under **Preferences → Keyboard Shortcuts** (search "Code Feedback"). All actions are also available via the Command Palette and the panel.

## Installation

**From the Marketplace** (once published): search **Code Feedback** in the Extensions view and install. Works in VS Code, Cursor, and other VS Code-compatible editors.

**From source** (TypeScript; compiles with `tsc`, no runtime dependencies):

```bash
git clone https://github.com/thesatellite-ai/vscode-code-feedback.git
cd vscode-code-feedback
pnpm install                                                  # toolchain (TypeScript + oxlint), dev only
pnpm dlx @vscode/vsce package --no-dependencies --allow-missing-repository --skip-license   # compiles via vscode:prepublish
code   --install-extension code-feedback-0.1.0.vsix --force
cursor --install-extension code-feedback-0.1.0.vsix --force   # optional, for Cursor
```

Then reload your editor windows. A `Taskfile.yml` wraps these as `task deps`, `task build`, `task reinstall`, `task status`, and `task uninstall` if you have [Task](https://taskfile.dev/) installed.

## Storage & privacy

- Notes are stored locally as a JSON file in the extension's global storage directory, tagged with their project. Nothing is sent anywhere. The sidebar shows only the current project's notes; **Preview All** reads across every project.
- The code snippet is captured when you add the note. If you later edit the file, the saved snippet does not change, and line numbers may drift.

## License

[MIT](LICENSE) © khanakia
