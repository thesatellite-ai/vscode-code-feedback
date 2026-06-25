# Code Feedback

> Leave review-comment-style notes on code lines, track them as Open/Resolved, then copy the open ones as one clean markdown list to paste into your AI agent.

Code Feedback turns the loop of "review code → jot what's wrong → hand it to an AI" into something native to your editor. Select lines, write a note (with `#tags`), and it lands in a sidebar that works like local PR review comments. When you're ready, one shortcut copies every open note — `file:line` + your comment + the code snippet — straight to your clipboard for Claude Code, Cursor, Copilot, or any agent.

No files are modified. Notes live outside your code, persisted per project, and survive reloads and restarts.

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

**From source** (no build step — plain JavaScript):

```bash
git clone https://github.com/thesatellite-ai/vscode-code-feedback.git
cd vscode-code-feedback
npx --yes @vscode/vsce package --allow-missing-repository --skip-license
code   --install-extension code-feedback-0.1.0.vsix --force
cursor --install-extension code-feedback-0.1.0.vsix --force   # optional, for Cursor
```

Then reload your editor windows. A `Taskfile.yml` wraps these as `task reinstall`, `task status`, and `task uninstall` if you have [Task](https://taskfile.dev/) installed.

## Storage & privacy

- Notes are stored locally as a JSON file in the extension's global storage directory, tagged with their project. Nothing is sent anywhere. The sidebar shows only the current project's notes; **Preview All** reads across every project.
- The code snippet is captured when you add the note. If you later edit the file, the saved snippet does not change, and line numbers may drift.

## License

[MIT](LICENSE) © khanakia
