# Changelog

All notable changes to the **Code Feedback** extension are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/), and the project adheres to [Semantic Versioning](https://semver.org/).

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
