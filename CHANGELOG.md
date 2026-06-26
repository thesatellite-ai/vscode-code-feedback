# Changelog

All notable changes to the **Code Feedback** extension are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/), and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Short note IDs + "Resolve by IDs".** Every note now has a short `[id]` (e.g. `a3f9`) shown in the copied markdown. A new panel toggle and title-bar command let you paste a list of IDs (any separator) and bulk-resolve every matching note — built for the loop where an AI agent reports back which notes it completed.

### Changed

- Rewritten in **TypeScript** (strict) with an `oxlint` pass; compiles to `out/extension.js`. Package manager is **pnpm**. No runtime dependencies.
- New **brand kit** (`brand/`) and marketplace icon; README rewritten with a pitch + badges.

## [0.1.0] - 2026-06-25

Initial release.

### Added

- Add a feedback note from the current selection (`Cmd/Ctrl+Alt+N`), capturing file path, line range, and the code snippet.
- Inline `#tags` when writing a note (e.g. `broken auth #bug #api`).
- **Open / Resolved** status per note, with resolve/reopen and collapsible groups in the sidebar.
- Webview sidebar with a live inline filter (text + `#tag` with autocomplete), clickable tag chips, and a **This file only** scope toggle.
- Editor decorations: gutter dot, line highlight, and overview-ruler tick on every noted line (yellow = open, grey = resolved), with the note text on hover.
- **Copy Open Notes** (`Cmd/Ctrl+Alt+C`) to the clipboard as a markdown list ready to paste into an AI agent; plus **Copy All incl. Resolved**.
- **Preview All Notes** across every project in one read-only markdown document.
- Per-project storage that survives reloads and restarts (JSON in the extension's global storage), with clear actions at note / resolved / project / all-projects scope.
