// Code Feedback brand kit generator — concept: comment + marker, amber/gold on slate.
// Run: node gen-brand.mjs   → writes all SVG marks + design tokens into this dir.
// Single source of truth: tweak PALETTE / geometry here and regenerate everything.
// PNG/og raster is handled separately by `task raster` (rsvg-convert) — see README.
import { writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const OUT = dirname(fileURLToPath(import.meta.url))

// ── Palette ────────────────────────────────────────────────────────────────
// Brand = amber. The signature accent is `gold-400` (#F5C53D) — the exact color
// the extension paints in the editor gutter for an open note. Tiles are slate
// (the dark-editor identity the product lives in).
const C = {
	amber: {
		50: "#FFFBEB", 100: "#FEF3C7", 200: "#FDE68A", 300: "#FCD34D", 400: "#FBBF24",
		500: "#F59E0B", 600: "#D97706", 700: "#B45309", 800: "#92400E", 900: "#78350F", 950: "#451A03",
	},
	gold: { 400: "#F5C53D" }, // the gutter-marker color — brand accent
	slate: {
		50: "#F8FAFC", 100: "#F1F5F9", 200: "#E2E8F0", 300: "#CBD5E1", 400: "#94A3B8",
		500: "#64748B", 600: "#475569", 700: "#334155", 800: "#1E293B", 900: "#0F172A", 950: "#020617",
	},
	ink: "#0B0B12",
	white: "#FFFFFF",
}

// ── Shared geometry (512 master) ─────────────────────────────────────────────
const grad = (id, a, b, x2 = 512, y2 = 512) =>
	`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`

// Comment bubble (decorative frame, like lore's orbit — dropped in favicon) +
// three code-line bars + the accent marker dot in the gutter beside the top line.
const glyph = (fg, accent, { bubble = true } = {}) =>
	`${bubble ? `<path d="M150 120 H362 a48 48 0 0 1 48 48 V274 a48 48 0 0 1 -48 48 H242 l-46 52 v-52 H150 a48 48 0 0 1 -48 -48 V168 a48 48 0 0 1 48 -48 Z" fill="none" stroke="${fg}" stroke-opacity="0.32" stroke-width="6"/>\n  ` : ""}<circle cx="158" cy="178" r="13" fill="${accent}"/>
  <g fill="${fg}">
    <rect x="190" y="164" width="150" height="28" rx="14"/>
    <rect x="158" y="208" width="196" height="28" rx="14"/>
    <rect x="190" y="252" width="120" height="28" rx="14"/>
  </g>`

const svgOpen = (w, h, label) =>
	`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">`

// Full tile icon as a standalone file
const iconFile = (id, a, b, fg, accent, opts) =>
	`${svgOpen(512, 512, "Code Feedback")}
  <defs>${grad(id, a, b)}</defs>
  <rect width="512" height="512" rx="112" fill="url(#${id})"/>
  ${glyph(fg, accent, opts)}
</svg>
`

// ── Marks ────────────────────────────────────────────────────────────────────
const W = (f, s) => writeFileSync(`${OUT}/${f}`, s)

// color (primary, dark editor tile), dark-tile, light-tile
W("cf-icon.svg",       iconFile("g-color", C.slate[800], C.slate[950], C.white,       C.gold[400]))
W("icon.svg",          iconFile("g-color2", C.slate[800], C.slate[950], C.white,      C.gold[400])) // generic alias
W("cf-icon-dark.svg",  iconFile("g-dark",  C.slate[900], C.slate[950], C.slate[100],  C.gold[400]))
W("cf-icon-light.svg", iconFile("g-light", C.amber[50],  C.amber[100], C.slate[900],  C.amber[600]))

// favicon — drop the bubble frame so it stays legible at 16px
W("favicon.svg",       iconFile("g-fav",   C.slate[800], C.slate[950], C.white,       C.gold[400], { bubble: false }))

// glyph only (no tile) for light backgrounds — slate lines + amber marker
W("cf-glyph.svg",      `${svgOpen(512, 512, "Code Feedback glyph")}\n  ${glyph(C.slate[800], C.amber[500])}\n</svg>\n`)

// monochrome — single color via currentColor (terminals, print, one-color)
W("cf-mono.svg",       `${svgOpen(512, 512, "Code Feedback")}\n  ${glyph("currentColor", "currentColor")}\n</svg>\n`)

// ── Wordmark + lockups ───────────────────────────────────────────────────────
const FONT = "'Space Grotesk', 'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const wordmark = (fill, weightAccent) =>
	`<text x="0" y="86" font-family="${FONT}" font-size="80" font-weight="600" letter-spacing="-3" fill="${fill}">Code <tspan fill="${weightAccent}">Feedback</tspan></text>`

// standalone wordmark (ink "Code", amber "Feedback", on light)
W("cf-wordmark.svg",
	`${svgOpen(600, 120, "Code Feedback")}\n  ${wordmark(C.ink, C.amber[600])}\n</svg>\n`)

// horizontal lockups: scaled color icon + wordmark
const lockup = (id, a, b, fg, accent, textFill, accentFill) =>
	`${svgOpen(720, 200, "Code Feedback")}
  <defs>${grad(id, a, b)}</defs>
  <g transform="translate(20,36) scale(0.25)">
    <rect width="512" height="512" rx="112" fill="url(#${id})"/>
    ${glyph(fg, accent)}
  </g>
  <text x="176" y="124" font-family="${FONT}" font-size="72" font-weight="600" letter-spacing="-3" fill="${textFill}">Code <tspan fill="${accentFill}">Feedback</tspan></text>
</svg>
`
W("cf-lockup.svg",       lockup("l-color", C.slate[800], C.slate[950], C.white, C.gold[400], C.ink,        C.amber[600])) // on light
W("cf-lockup-dark.svg",  lockup("l-dark",  C.slate[800], C.slate[950], C.white, C.gold[400], C.white,      C.gold[400]))  // on dark

// ── OG covers (1200×630) ─────────────────────────────────────────────────────
const og = (file, bgA, bgB, textMain, textAccent, textSub1, textSub2, accentLine) =>
	W(file, `${svgOpen(1200, 630, "Code Feedback — review-comment notes for your code, copied to your AI agent")}
  <defs>
    ${grad("og-bg", bgA, bgB, 1200, 630)}
    ${grad("og-icon", C.slate[800], C.slate[950])}
  </defs>
  <rect width="1200" height="630" fill="url(#og-bg)"/>
  <g transform="translate(96,170) scale(0.52)">
    <rect width="512" height="512" rx="112" fill="url(#og-icon)"/>
    ${glyph(C.white, C.gold[400])}
  </g>
  <text x="412" y="282" font-family="${FONT}" font-size="96" font-weight="600" letter-spacing="-4" fill="${textMain}">Code <tspan fill="${textAccent}">Feedback</tspan></text>
  <rect x="416" y="314" width="86" height="8" rx="4" fill="${accentLine}"/>
  <text x="414" y="386" font-family="${FONT}" font-size="38" font-weight="500" fill="${textSub1}">Leave review notes on code lines.</text>
  <text x="414" y="440" font-family="${FONT}" font-size="28" font-weight="400" fill="${textSub2}">Copy them to your AI agent · VS Code &amp; Cursor · open source.</text>
</svg>
`)
og("og-cover.svg",       C.slate[800], C.slate[950], C.white,       C.gold[400],  C.slate[200], C.slate[400], C.gold[400])  // dark
og("og-cover-light.svg", C.amber[50],  C.amber[100], C.slate[900],  C.amber[600], C.slate[700], C.slate[500], C.amber[500]) // light

console.log("✓ marks + lockups + og written")

// ── Design tokens ────────────────────────────────────────────────────────────
const palette = {
	$meta: { name: "code-feedback", concept: "comment + marker", brand: "amber/gold", generated_by: "gen-brand.mjs" },
	amber: C.amber,
	gold: C.gold,
	slate: C.slate,
	neutral: { ink: C.ink, white: C.white, 100: "#F4F4F5", 300: "#D4D4D8", 500: "#71717A", 700: "#3F3F46", 900: "#18181B" },
	accent: C.gold[400],
	semantic: {
		light: { bg: C.white, surface: C.amber[50], text: C.slate[900], muted: C.slate[600], brand: C.amber[600], brandStrong: C.amber[700], accent: C.amber[500], border: C.amber[100] },
		dark: { bg: C.slate[950], surface: C.slate[900], text: C.slate[50], muted: C.slate[400], brand: C.amber[400], brandStrong: C.gold[400], accent: C.gold[400], border: C.slate[800] },
	},
}
W("palette.json", `${JSON.stringify(palette, null, 2)}\n`)

const tokens = {
	$meta: palette.$meta,
	color: palette,
	font: {
		display: "Space Grotesk",
		sans: "Inter",
		mono: "JetBrains Mono",
		stack: { display: FONT, sans: "'Inter', ui-sans-serif, system-ui, sans-serif", mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" },
		weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
		tracking: { tight: "-0.03em", normal: "0", wide: "0.02em" },
	},
	radius: { sm: "6px", md: "10px", lg: "16px", xl: "24px", tile: "112px@512", pill: "9999px" },
	icon: { master: "512", favicon: [16, 32, 48, 180, 512], og: [1200, 630] },
}
W("tokens.json", `${JSON.stringify(tokens, null, 2)}\n`)

const css = `:root {
  /* Code Feedback brand — amber/gold on slate (concept: comment + marker). Generated by gen-brand.mjs. */
  --cf-amber-50: ${C.amber[50]};   --cf-amber-100: ${C.amber[100]};
  --cf-amber-200: ${C.amber[200]}; --cf-amber-300: ${C.amber[300]};
  --cf-amber-400: ${C.amber[400]}; --cf-amber-500: ${C.amber[500]};
  --cf-amber-600: ${C.amber[600]}; --cf-amber-700: ${C.amber[700]};
  --cf-amber-800: ${C.amber[800]}; --cf-amber-900: ${C.amber[900]};
  --cf-amber-950: ${C.amber[950]};
  --cf-gold-400: ${C.gold[400]};
  --cf-slate-50: ${C.slate[50]};   --cf-slate-100: ${C.slate[100]};
  --cf-slate-400: ${C.slate[400]}; --cf-slate-600: ${C.slate[600]};
  --cf-slate-800: ${C.slate[800]}; --cf-slate-900: ${C.slate[900]}; --cf-slate-950: ${C.slate[950]};
  --cf-ink: ${C.ink};

  /* fonts */
  --cf-font-display: ${FONT};
  --cf-font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --cf-font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --cf-radius: 16px;

  /* semantic — light (default) */
  --cf-bg: ${palette.semantic.light.bg};
  --cf-surface: ${palette.semantic.light.surface};
  --cf-text: ${palette.semantic.light.text};
  --cf-muted: ${palette.semantic.light.muted};
  --cf-brand: ${palette.semantic.light.brand};
  --cf-brand-strong: ${palette.semantic.light.brandStrong};
  --cf-accent: ${palette.semantic.light.accent};
  --cf-border: ${palette.semantic.light.border};
}

[data-theme="dark"], .dark {
  --cf-bg: ${palette.semantic.dark.bg};
  --cf-surface: ${palette.semantic.dark.surface};
  --cf-text: ${palette.semantic.dark.text};
  --cf-muted: ${palette.semantic.dark.muted};
  --cf-brand: ${palette.semantic.dark.brand};
  --cf-brand-strong: ${palette.semantic.dark.brandStrong};
  --cf-accent: ${palette.semantic.dark.accent};
  --cf-border: ${palette.semantic.dark.border};
}
`
W("tokens.css", css)
console.log("✓ palette.json, tokens.json, tokens.css written")
