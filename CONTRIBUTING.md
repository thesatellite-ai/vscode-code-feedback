# Contributing to Code Feedback

Thanks for your interest in improving Code Feedback. It's a small TypeScript extension with no runtime dependencies — `tsc` compiles `src/extension.ts` to `out/extension.js`, and the only things required at runtime are the host-provided `vscode` API and Node's `fs`/`path`. Package manager: **pnpm**.

## Project layout

- `src/extension.ts` — the entire extension: types, storage, commands, editor decorations, and the webview sidebar (HTML/CSS/JS is inlined in `getHtml`).
- `out/extension.js` — compiled output (git-ignored; built by `tsc`).
- `tsconfig.json` — strict TypeScript config (`strict`, `noUnusedLocals/Parameters`, etc.).
- `package.json` — the manifest (commands, menus, keybindings, webview view) plus `scripts` (`compile`/`watch`/`vscode:prepublish`) and the dev-only `devDependencies` (`typescript`, `@types/vscode`, `@types/node`).
- `Taskfile.yml` — reusable dev commands (deps, build, watch, package, install, publish). Requires [Task](https://taskfile.dev/); each command is also runnable by hand.

## Running it locally

```bash
pnpm install    # or: task deps — installs the toolchain (TypeScript + oxlint)
```

Then either:

1. **Dev host:** open this folder in VS Code and press `F5` (it runs `npm: compile` first via the preLaunch task in `.vscode/launch.json`, then opens an Extension Development Host). Edit, recompile (`task watch` keeps it live), reload the window.
2. **Install the built extension:** `task reinstall`, then reload your editor windows.

## Making changes

- Stay dependency-free at runtime. Dev dependencies (types, tsc) are fine; a runtime dependency needs discussion first — open an issue.
- Full type safety: no `any`, no `as any`, no `@ts-ignore`. Values crossing a boundary (the JSON store, webview messages) are validated before use (`toNote`, the guard in `onMessage`).
- The webview UI lives inside `getHtml`. Escape any user-provided text with the `esc` helper before inserting it into HTML — notes can contain arbitrary characters.
- Validate before opening a PR:
  - `pnpm run lint` (or `task lint`) — oxlint, must be clean.
  - `pnpm run compile` (or `task build`, which lints then compiles) — a clean strict-TS compile is the gate.
  - `pnpm dlx @vscode/vsce package --no-dependencies --allow-missing-repository --skip-license` — must produce a `.vsix` without errors.
- Update `CHANGELOG.md` under an `Unreleased` heading describing your change.

## Reporting bugs / requesting features

Open an issue at https://github.com/thesatellite-ai/vscode-code-feedback/issues with steps to reproduce, your VS Code version, and what you expected.

## License

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
