# Code Feedback — brand

Visual identity for **Code Feedback**. Concept: **comment + marker** — a code-review comment bubble holding stacked code lines, with the **gold gutter marker** (the exact dot the extension paints beside an open note) in the gutter. Brand color: **amber/gold** on a **slate** dark-editor tile.

Everything here is generated from a single source — edit [`gen-brand.mjs`](./gen-brand.mjs) and run `task gen` (or `node gen-brand.mjs`); raster with `task raster`. Never hand-edit the output SVGs/PNGs.

## Files

| File | What | Use |
|---|---|---|
| `cf-icon.svg` / `icon.svg` | Primary app icon — slate tile, white code lines, comment frame, gold marker | Default everywhere |
| `cf-icon-dark.svg` | Deepest-slate variant | On bright/colored surfaces |
| `cf-icon-light.svg` | Light-tile variant (amber, slate glyph) | On dark surfaces / light UI chrome |
| `cf-glyph.svg` | Glyph only, no tile (slate lines + amber marker) | On white, inline, watermarks |
| `cf-mono.svg` | Single color via `currentColor` | Terminals, print, one-color contexts |
| `favicon.svg` | Comment frame removed for legibility at 16px | Browser tab |
| `cf-wordmark.svg` | `Code Feedback` wordmark (ink + amber) | Standalone wordmark |
| `cf-lockup.svg` / `-dark.svg` | Icon + wordmark, horizontal | Headers, nav, READMEs |
| `og-cover.svg` / `-light.svg` | 1200×630 social card | OpenGraph / Twitter, docs hero |
| `png/` | Rasterized favicons, apple-touch, 128/512/1024 icons, OG covers | Production embedding |
| `favicon.ico` | Multi-res 16/32/48 | Legacy favicon |
| `palette.json` · `tokens.json` · `tokens.css` | Design tokens | App theming |

The `cf-icon.svg` mirrors the marketplace icon, but the extension's own packaged icon (`../icon.png`) is generated separately — keep them visually in sync if you change the mark.

## Color

Amber scale (50→950) + a gold accent on slate neutrals. Full values in `palette.json`; CSS variables in `tokens.css` (light is default, `[data-theme="dark"]` / `.dark` flips semantics).

| Token | Hex | Role |
|---|---|---|
| gold-400 | `#F5C53D` | Accent — the gutter marker (the product's signature dot) |
| amber-500 | `#F59E0B` | Brand spark, glyph-on-white marker |
| amber-600 | `#D97706` | Brand (light mode), "Feedback" wordmark |
| amber-400 | `#FBBF24` | Brand (dark mode) |
| slate-800 | `#1E293B` | Tile gradient start (dark editor) |
| slate-950 | `#020617` | Tile gradient end, dark surface / OG background |
| slate-900 | `#0F172A` | Text on light, dark surface |
| ink | `#0B0B12` | Neutral text ("Code" wordmark) |

## Type

All open-source (OFL), free to self-host or load via Google Fonts.

| Role | Font | Notes |
|---|---|---|
| Display / wordmark | **Space Grotesk** (600) | Tight tracking (`-0.03em`). The `Code Feedback` wordmark + OG headline |
| UI / body | **Inter** | App and docs text |
| Code / mono | **JetBrains Mono** | CLI output, code samples |

Stacks are in `tokens.json` → `font.stack`. The SVG wordmark/OG declare Space Grotesk with a system fallback, so previews render even without the webfont installed; embed the webfont for the true mark.

## Regenerate

```sh
task gen      # SVG marks + tokens from gen-brand.mjs
task raster   # PNGs + favicon.ico (needs rsvg-convert + magick)
task all      # both
```

## Don'ts

- Don't recolor outside the palette — pick a tile variant instead.
- Don't stretch or rotate the mark; the comment-tail direction is intentional.
- Don't add effects (shadows, bevels). The mark is flat.
- Don't put the full comment-frame icon below ~24px — use `favicon.svg` (frame removed).
- Keep the gold marker gold — it's the one fixed brand signal, matching the editor gutter.
- Keep clearspace ≥ 25% of the icon's width on all sides.
