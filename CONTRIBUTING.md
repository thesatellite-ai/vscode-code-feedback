# Contributing to Code Feedback

Thanks for your interest in improving Code Feedback. This is a small, zero-dependency extension — there's no build step, which keeps the contribution loop fast.

## Project layout

- `extension.js` — the entire extension: storage, commands, editor decorations, and the webview sidebar (HTML/CSS/JS is inlined in `getHtml`).
- `package.json` — the manifest: commands, menus, keybindings, and the webview view contribution.
- `Taskfile.yml` — reusable dev commands (package, install, publish). Requires [Task](https://taskfile.dev/); each command is also runnable by hand.

There is no `node_modules` and no compile step — the extension is plain CommonJS using only the `vscode` API and Node's `fs`/`path`.

## Running it locally

Two options:

1. **Dev host:** open this folder in VS Code and press `F5`. A second "Extension Development Host" window launches with the extension active. Edit code, then reload that window to apply.
2. **Install the built extension:** `task reinstall` (or run the steps in the README's Install section), then reload your editor windows.

## Making changes

- Keep it dependency-free. If a change seems to need a package, open an issue first to discuss.
- The webview UI lives inside `getHtml`. Escape any user-provided text with the `esc` helper before inserting it into HTML — notes can contain arbitrary characters.
- Validate before opening a PR:
  - `node --check extension.js`
  - `npx --yes @vscode/vsce package --allow-missing-repository --skip-license` (the package step is the real test for a no-build extension — it must produce a `.vsix` without errors).
- Update `CHANGELOG.md` under an `Unreleased` heading describing your change.

## Reporting bugs / requesting features

Open an issue at https://github.com/thesatellite-ai/vscode-code-feedback/issues with steps to reproduce, your VS Code version, and what you expected.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
