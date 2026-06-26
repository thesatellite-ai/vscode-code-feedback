<div align="center">

<img src="brand/png/cf-icon-512.png" width="104" alt="Code Feedback" />

# Code Feedback

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/khanakia.code-feedback-notes?label=Marketplace&logo=visualstudiocode&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=khanakia.code-feedback-notes)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/khanakia.code-feedback-notes?label=installs&color=4c1)](https://marketplace.visualstudio.com/items?itemName=khanakia.code-feedback-notes)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/khanakia.code-feedback-notes?label=downloads&color=4c1)](https://marketplace.visualstudio.com/items?itemName=khanakia.code-feedback-notes)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/khanakia.code-feedback-notes?label=rating)](https://marketplace.visualstudio.com/items?itemName=khanakia.code-feedback-notes&ssr=false#review-details)
[![Open VSX](https://img.shields.io/open-vsx/v/khanakia/code-feedback-notes?label=Open%20VSX&color=a60ee5)](https://open-vsx.org/extension/khanakia/code-feedback-notes)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/khanakia/code-feedback-notes?label=OVSX%20downloads)](https://open-vsx.org/extension/khanakia/code-feedback-notes)
[![CI](https://github.com/thesatellite-ai/vscode-code-feedback/actions/workflows/ci.yml/badge.svg)](https://github.com/thesatellite-ai/vscode-code-feedback/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/tag/thesatellite-ai/vscode-code-feedback?sort=semver&label=release)](https://github.com/thesatellite-ai/vscode-code-feedback/tags)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.75-007ACC?logo=visualstudiocode&logoColor=white)
![Cursor](https://img.shields.io/badge/Cursor-compatible-000?logo=cursor&logoColor=white)
![Zero deps](https://img.shields.io/badge/runtime%20deps-0-success)

**Leave review-comment notes on code lines, track them as Open/Resolved, then copy the open ones as one clean markdown list — `file:line` + comment + snippet — to paste straight into Claude Code, Cursor, or Copilot.**

<img src="media/screenshots/hero.png" alt="Code Feedback in VS Code — the notes panel beside a Go file with a noted line highlighted in the gutter" width="900" />

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
- **Short note IDs + bulk resolve** — every note has a short `[id]` shown in the copied markdown. Ask your agent which IDs it finished, paste the list into **Resolve by ID**, and they all close at once.
- **Inline live filter** — a search box in the panel narrows as you type; match text or `#tags`, with tag autocomplete.
- **Tag chips** — every tag in the project shows as a clickable chip to toggle as a filter.
- **This file only** — one toggle scopes the list to the file you're viewing, and follows you across tabs.
- **In-editor markers** — every noted line gets a gutter dot, a highlight, and an overview-ruler tick (yellow = open, grey = resolved), with the note on hover.
- **Copy for your agent** — open notes (or all, with resolved marked) formatted as a markdown list. Click a note to jump back and select the lines.
- **Across projects** — the eye icon previews **this project**; the ⋯ overflow has **Preview All** to gather every project's notes into one read-only doc.

<img src="media/screenshots/03-gutter.png" alt="The sidebar showing Open and Resolved groups next to the editor, where noted lines have gutter dots and a hovered line shows the note in a tooltip" width="820" />

## Workflow

<img src="media/screenshots/02-add-note.png" alt="Selecting lines in a Go file and adding a note — the input box shows the note text with a #bug tag and the captured file:line range" width="660" />

1. Select one or more lines (or just place the cursor on a line).
2. Right-click → **Code Feedback: Add Note from Selection** (or press `Cmd/Ctrl+Alt+N`).
3. Type your feedback. Add tags inline with `#` — e.g. `broken auth #bug #api`. It lands in the **Code Feedback** panel under **Open**.
4. Repeat across as many files as you want — the list keeps growing.
5. Press `Cmd/Ctrl+Alt+C` (or the copy icon in the panel title) to copy all open notes.
6. Paste into your AI agent.
7. As things get fixed, hover a note and click **✓** to resolve it — it moves to the Resolved group and drops out of the next copy.

## The sidebar

<img src="media/screenshots/01-sidebar.png" alt="Code Feedback sidebar — notes grouped under Open, each with a short ID, the note text, file:line, and tags; a filter box and tag chips on top" width="660" />

A live **filter box** at the top, a row of **tag chips**, then notes grouped into collapsible **Open** and **Resolved** sections.

- **Filter** — type to narrow. Words match file path / note / snippet; `#tag` tokens filter by tag (e.g. `auth #bug`). Typing `#` shows an autocomplete dropdown of your existing tags.
- **Tag chips** — click a tag to filter by it (highlighted when active); click again to release.
- **Per note** (on hover): **✓ resolve** / **↺ reopen**, **edit** (text + tags), **delete**. Click the note body to reveal and select the lines.

<img src="media/screenshots/04-filter.png" alt="Filtering the notes list by typing text and clicking the active #bug tag chip, narrowing to one matching note" width="420" />

## Icons & controls

<img src="media/screenshots/07-titlebar.png" alt="The Code Feedback panel title bar with its icons and a tooltip reading Show Notes for Current File Only" width="520" />

Every control in the extension, what it is, and what it does. (Hover any title-bar icon to see its tooltip — set `workbench.hover.delay` to `0` if you want them instant.)

### Panel title bar (top of the Code Feedback view)

| Icon | Action | What it does |
|---|---|---|
| <img src="media/icons/files.png" width="16" alt="files"> / <img src="media/icons/file.png" width="16" alt="file"> | Show notes for current file only — toggle | Stacked-files icon = showing **all** files; click to scope the list to the file you're viewing. It then becomes a single-file icon; click again to show all. Follows you as you switch tabs. |
| <img src="media/icons/copy.png" width="16" alt="copy"> | Copy Open Notes | Copies all **open** notes in this project to the clipboard as markdown, ready to paste into an AI agent. Respects the active filter. (`Cmd/Ctrl+Alt+C`) |
| <img src="media/icons/check-all.png" width="16" alt="check-all"> | Resolve by ID | Opens a box — paste a list of note IDs (one per line, or any separator) and click **Resolve** to bulk-close them. |
| <img src="media/icons/eye.png" width="16" alt="eye"> | Preview Notes (this project) | Opens a read-only markdown doc of **this project's** notes. |
| <img src="media/icons/ellipsis.png" width="16" alt="more"> | Overflow menu | **Preview All Notes (all projects)** · **Copy All incl. Resolved** · **Clear Resolved (this project)** · **Clear All (this project)** · **Clear All Notes (all projects)**. Clears ask for confirmation first. |

### Inside the panel

| Element | What it does |
|---|---|
| **Filter box** | Live-narrows the list as you type. Words match file path / note / snippet; `#tag` tokens filter by tag. Typing `#` shows a tag autocomplete dropdown. |
| **Tag chips** | One per tag in the project. Click to filter by that tag (highlighted when active); click again to release. |
| **`▸` / `▾` group headers** | Collapse / expand the **Open** and **Resolved** groups. State is remembered. |
| **`a3f9`** (mono, left of each note) | The note's short **ID** — also shown in the copied markdown as `[a3f9]`. Use it with **Resolve by ID**. |
| **● dot** (left of a note row) | Status: amber = open, grey = resolved. |

### On a note row (appear on hover, right side)

| Icon | Action |
|---|---|
| **✓** | Resolve the note (open notes only) |
| **↺** | Reopen the note (resolved notes only) |
| **✎** | Edit the note text + `#tags` |
| **✕** | Delete the note |
| *(click the row body)* | Reveal the file and **select** the noted lines |

### In the editor (on noted lines)

| Marker | Meaning |
|---|---|
| **Gutter dot** — amber | An **open** note is on this line |
| **Gutter check** — grey | A **resolved** note is on this line |
| **Line highlight + left border** | The noted line range |
| **Overview-ruler tick** (right scrollbar) | Jump-spot for a note anywhere in the file |
| *(hover the line)* | Shows the note text |

## What gets copied

````markdown
## Feedback notes

1. `[a3f9]` `api/pay.go:42-45`  #bug #api
   > needs idempotency key — duplicate charges possible

   ```go
   func Pay(ctx context.Context) error {
       charge(ctx)
   }
   ```

2. `[k7m2]` `web/cart.tsx:88`
   > empty-cart case not handled, crashes

   ```tsx
   const total = items.reduce(...)
   ```
````

<img src="media/screenshots/05-copy.png" alt="The notes pasted as markdown — each entry leads with its [id] and file:line, then the note and the code snippet (shown via Preview All, grouped by project)" width="720" />

Each note leads with a short `[id]`. After your agent works through the list, ask it for the IDs it completed, then click the title-bar **✓✓ Resolve by ID** button — paste them one per line and click **Resolve** to close them all in bulk.

<img src="media/screenshots/06-resolve-by-id.png" alt="The Resolve by ID box open with two note IDs pasted, ready to bulk-resolve them" width="420" />

## Keybindings

| Action | macOS | Windows / Linux |
|---|---|---|
| Add note from selection | `Cmd+Alt+N` | `Ctrl+Alt+N` |
| Copy open notes | `Cmd+Alt+C` | `Ctrl+Alt+C` |

Rebind under **Preferences → Keyboard Shortcuts** (search "Code Feedback"). All actions are also available via the Command Palette and the panel.

## Installation

**Search "Code Feedback"** in your editor's Extensions view, or install from a registry directly:

- **VS Code Marketplace** → [marketplace.visualstudio.com/items?itemName=khanakia.code-feedback-notes](https://marketplace.visualstudio.com/items?itemName=khanakia.code-feedback-notes) — or `code --install-extension khanakia.code-feedback-notes`
- **Open VSX** (Cursor / VSCodium / Gitpod) → [open-vsx.org/extension/khanakia/code-feedback-notes](https://open-vsx.org/extension/khanakia/code-feedback-notes) — or `cursor --install-extension khanakia.code-feedback-notes`

**From a release (`.vsix`)** — no Marketplace account needed:

1. Download the latest `code-feedback-<version>.vsix` from the [**Releases page**](https://github.com/thesatellite-ai/vscode-code-feedback/releases).
2. In VS Code or Cursor: **Extensions** view → **⋯** → **Install from VSIX…** → pick the file. Or from the CLI:
   ```bash
   code   --install-extension code-feedback-notes-0.1.0.vsix
   cursor --install-extension code-feedback-notes-0.1.0.vsix
   ```
3. Reload the window.

**From source** (TypeScript; compiles with `tsc`, no runtime dependencies):

```bash
git clone https://github.com/thesatellite-ai/vscode-code-feedback.git
cd vscode-code-feedback
pnpm install                                                  # toolchain (TypeScript + oxlint), dev only
pnpm dlx @vscode/vsce package --no-dependencies --allow-missing-repository --skip-license   # compiles via vscode:prepublish
code   --install-extension code-feedback-notes-0.1.0.vsix --force
cursor --install-extension code-feedback-notes-0.1.0.vsix --force   # optional, for Cursor
```

Then reload your editor windows. A `Taskfile.yml` wraps these as `task deps`, `task build`, `task reinstall`, `task status`, and `task uninstall` if you have [Task](https://taskfile.dev/) installed.

## Storage & privacy

- Notes are stored locally as a JSON file in the extension's global storage directory, tagged with their project. Nothing is sent anywhere. The sidebar shows only the current project's notes; **Preview All** reads across every project.
- The code snippet is captured when you add the note. If you later edit the file, the saved snippet does not change, and line numbers may drift.

## License

[MIT](LICENSE) © khanakia
