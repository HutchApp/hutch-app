# Hutch — Brand & Design Guidelines

> Internal reference for anyone building Hutch — developers, designers, contributors.
> Consult this before shipping UI, writing copy, or producing any public-facing asset.

---

## Brand Identity

**Tagline:** A warm, dependable home for your reading list.

**What Hutch is:** A read-it-later app that saves articles, blog posts, and web pages for later reading. Born from a personal reading system refined over 10 years.

**What Hutch feels like:** A well-made tool built by someone who uses it every day. A private reading nook in a home library — warm wood, good lighting, no distractions. Not a co-working space. Not a productivity dashboard. A quiet place that's yours.

### Brand Attributes

| Attribute | Means | Does NOT mean |
|---|---|---|
| Trustworthy | Reliable, transparent, proven over time | Corporate, institutional, stiff |
| Warm | Approachable, personal, human-built | Cutesy, childish, overly playful |
| Quiet confidence | Knows its value without shouting | Arrogant, flashy, "disruptive" |
| Crafted | Thoughtful attention to detail | Overdesigned, trendy, maximalist |
| Enduring | Built to last, not built to sell | Disposable, startup-y, growth-hacky |

---

## Logo

### The Icon

The icon is a serif **"H"** letterform with two horizontal shelves and an open book on the top shelf. It functions as a piece of hutch furniture — a visual shorthand for "a place where your reading lives."

### Assets

Icon assets live in `/projects/hutch/src/public/` and `/projects/firefox-extension/src/icons/`.

| Asset | Sizes available | Location |
|---|---|---|
| **Favicon** | 16, 32, 48, 96px + `.ico` | `projects/hutch/src/public/favicon-*.png` |
| **Apple Touch Icon** | 57–180px (multiple sizes) | `projects/hutch/src/public/apple-touch-icon-*.png` |
| **Android Chrome** | 48–512px + maskable variants | `projects/hutch/src/public/android-chrome-*.png` |
| **Windows Tile** | 70, 150, 310×150, 310px | `projects/hutch/src/public/mstile-*.png` |
| **Social cards** | 1200×630 (OG), 1200×600 (Twitter) | `projects/hutch/src/public/og-image-*.png`, `twitter-card-*.png` |
| **Extension icon** | 16–128px | `projects/firefox-extension/src/icons/icon-*.png` |

### Usage Rules

- **Minimum clear space:** Maintain padding equal to at least the height of one shelf bar on all sides of the icon.
- **Do not** rotate, skew, add drop shadows, apply gradients, or place on busy photographic backgrounds.
- **Do not** recreate or approximate the logo — always use the provided assets.
- **Do not** separate the book from the H or rearrange the lock-up components.
- **Dark backgrounds:** Use the white/light version of the icon.
- **Light backgrounds:** Use the navy version of the icon.
- **At 16×16px:** The book detail may be dropped in favour of a simplified H-with-shelves mark for legibility. Prioritise recognisability over fidelity.

---

## Colour Palette

> **Source of truth:** `projects/hutch/src/runtime/web/base.styles.ts`

### Primary Colours

| Role | Colour | Hex / HSL | CSS variable | Usage |
|---|---|---|---|---|
| **Warm amber** (Primary) | Warm terracotta/amber-brown | `#c8702a` / `hsl(27 65% 47%)` | `--color-brand`, `--primary`, `--accent` | Hero backgrounds, interactive elements, highlights, CTAs, header brand text |
| **Amber dark** | Darker amber | `#a85a1e` | `--color-brand-dark` | Hover/active states on brand elements |
| **Amber light** | Pale amber tint | `#f5e6d3` | `--color-brand-light` | Subtle brand-tinted backgrounds |
| **Navy** (Secondary) | Deep navy blue | `#2B3A55` | — | Manifest theme colour, meta tags, extension icon background, extension active states |

### Neutrals

| Role | Light Mode | Dark Mode | CSS variable | Usage |
|---|---|---|---|---|
| **Background** | `#ffffff` | `#121212` | `--color-background` | Page/canvas background |
| **Surface** | `#F7F8FA` | `#1a1a1a` | `--color-surface` | Cards, panels, secondary containers |
| **Surface Elevated** | `#ffffff` | `#222222` | `--color-surface-elevated` | Elevated cards, popovers |
| **Border** | `#E2E5EA` | `#2e2e2e` | `--color-border` | Dividers, input borders, subtle separators |
| **Text — Primary** | `#1A202C` | `#e4e4e4` | `--color-text-primary` | Body text, headings |
| **Text — Secondary** | `#5A6170` | `#9BA1AE` | `--color-text-secondary` | Captions, placeholders, metadata |
| **Text — Muted** | `#8C919D` | `#6b6b6b` | `--color-text-muted` | Disabled states, timestamps |
| **Footer Background** | `#1a1a1a` | `#0d0d0d` | `--footer-bg` | Site footer |

### Functional Colours

| State | Light Mode | Dark Mode | CSS variable | Notes |
|---|---|---|---|---|
| **Success** | `#3D8B6E` | `#4a9f7f` | `--color-success` | Saved confirmations, sync complete |
| **Warning** | `#C8923C` | `#d4a04a` | `--color-warning` | Non-critical alerts |
| **Error** | `#C45C5C` | `#d46b6b` | `--color-error` | Validation errors, failed saves, destructive actions |
| **Info** | `#4A7FB5` | — | — | Informational banners, tips |

### Dark Mode Brand Adaptations

In dark mode, the brand colours shift slightly warmer and lighter to maintain contrast:

| Role | Light | Dark | CSS variable |
|---|---|---|---|
| Brand | `#c8702a` | `#d4833a` | `--color-brand` |
| Brand dark | `#a85a1e` | `#e89a55` | `--color-brand-dark` |
| Brand light | `#f5e6d3` | `#3d2a18` | `--color-brand-light` |
| Primary | `hsl(27 65% 47%)` | `hsl(27 65% 52%)` | `--primary` |

### Colour Rules

- **Never use pure black** (`#000000`) for backgrounds or text. Use the dark neutrals above.
- **Never use Pocket red**, Readwise yellow, or neon/high-saturation accents.
- **Dark mode is not an inversion.** Colours adapt to slightly warmer, lighter variants — it doesn't simply flip to white-on-black. Test every colour pairing against both backgrounds.
- **Warm amber on dark backgrounds** is the signature brand combination. When in doubt, lead with this pairing.
- **Reading surfaces should be neutral.** The amber appears in chrome and UI — never as the background behind article text. Article content sits on white/off-white (light) or dark grey (dark).
- **Hero gradient:** `linear-gradient(135deg, hsl(27 65% 47%) 0%, hsl(27 50% 35%) 100%)` — the signature landing-page gradient.

### Browser Extension Palette

The Firefox extension uses a slightly different palette tuned for small popup contexts:

| Role | Light | Dark | CSS variable |
|---|---|---|---|
| Brand | `#c8923c` | `#d4a04a` | `--popup-brand` |
| Icon background | `#2b3a55` | `#2b3a55` | `--popup-icon-bg` |
| Icon text | `#c8923c` | `#d4a04a` | `--popup-icon-text` |
| Active background | `#2b3a55` | `#3d4f6f` | `--popup-active-bg` |

---

## Typography

> **Source of truth:** `projects/hutch/src/runtime/web/base.styles.ts` (body font), `projects/hutch/src/runtime/web/base.template.html` (font loading)

### Typefaces in Use

| Role | Typeface | Weight | Where defined |
|---|---|---|---|
| **Body / UI** | `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` (Inter loaded from Google Fonts, weights 400–700) | 400, 500, 600, 700 | `base.styles.ts` → `BASE_RESET_STYLES`; `base.template.html` preload link |
| **Extension UI** | `Inter, "Source Sans Pro", system-ui, -apple-system, sans-serif` | — | `popup.styles.css` |
| **Brand serif** | `Georgia, "Times New Roman", serif` | — | Extension popup brand text |
| **Reader view** | User-configurable (default: high-legibility serif or sans) | Regular | Article body text in reading mode — this is the user's space |

### Typography Rules

- **Legibility is non-negotiable.** This is a product about reading. If a type choice looks good but reads poorly, reject it.
- **Line-height:** Body text uses `1.6` (set in `BASE_RESET_STYLES`). Minimum `1.3` for headings. Generous spacing is a feature, not a waste of space.
- **Never use all-caps** for more than short labels (e.g., "SAVED", "NEW"). Never for headings or body text.
- **International support:** Typefaces must include full Latin Extended character sets (Portuguese, accented characters). The founder is Brazilian-Australian — this is table stakes.
- **Avoid trendy typefaces.** If it will look dated in 2 years, don't ship it.

---

## Iconography & UI Elements

### Icon Style

- **Line-based**, consistent stroke weight (2px at 24×24 default size).
- Rounded end caps, slightly rounded joins — approachable but not bubbly.
- Use a single consistent icon library across all clients (Lucide, Phosphor, or equivalent).
- Icons should feel calm and functional. No filled/solid icons for primary navigation — save filled variants for active/selected states.

### Buttons

| Type | Style | Usage |
|---|---|---|
| **Primary** | Amber background (`--primary`), white text (`--primary-foreground`) | Main action per screen (Save, Import, Subscribe) |
| **Secondary** | Subtle amber tint (`--secondary`), amber text (`--secondary-foreground`) | Supporting actions (Cancel, Back, Filter) |
| **Destructive** | Muted red outline, red text → solid on hover | Delete, remove, unsave |
| **Ghost** | Text-only with hover underline or subtle background | Tertiary actions, inline links |
| **Brand** | `--primary` background, white text | Landing page CTAs |

### Border Radius

> Defined in `base.styles.ts` as CSS custom properties.

| Token | Value | CSS variable | Usage |
|---|---|---|---|
| Small | `6px` | `--radius-sm` | Buttons, inputs, chips |
| Default | `8px` | `--radius` | Cards, panels, navigation links |
| Large | `12px` | `--radius-lg` | Modals, dialogs, dropdown menus |

**Never fully rounded** (pill shapes) for primary UI. This isn't a social app.

### Shadows & Elevation

> Defined in `base.styles.ts`.

| Token | Light Mode | Dark Mode | CSS variable |
|---|---|---|---|
| Small | `0 1px 2px rgba(0,0,0,0.05)` | `0 1px 2px rgba(0,0,0,0.3)` | `--shadow-sm` |
| Medium | `0 4px 6px rgba(0,0,0,0.07)` | `0 4px 6px rgba(0,0,0,0.4)` | `--shadow-md` |

- Use shadows sparingly. Prefer subtle borders or background colour shifts over drop shadows.
- Maximum two levels of elevation in any screen. Flat is the default.

---

## Spacing & Layout

### Spacing Scale

Use a **4px base unit** with the following standard increments:

| Token | Value | Usage |
|---|---|---|
| `xs` | 4px | Inline spacing, tight gaps |
| `sm` | 8px | Between related elements, icon-to-label gaps |
| `md` | 16px | Standard padding, between list items |
| `lg` | 24px | Section padding, card internal padding |
| `xl` | 32px | Between major sections |
| `2xl` | 48px | Page-level margins, hero spacing |

### Form Inputs

> Defined in `base.styles.ts`.

| Token | Value | CSS variable |
|---|---|---|
| Height | `48px` | `--input-height` |
| Padding | `12px 16px` | `--input-padding` |
| Font size | `16px` | `--input-font-size` |
| Form gap | `20px` (24px on desktop) | `--form-gap` |

### Layout Principles

- **Content width for reading should max out at ~680px.** Wider text blocks reduce readability. Chrome and navigation can extend wider (max-width `1000px` for header/footer), but article content stays narrow.
- **Generous whitespace is intentional.** Don't fill space because it's empty. Breathing room is core to the brand.
- **Align to grid.** All spacing should use the 4px base. Avoid arbitrary pixel values.
- **Mobile first.** Every feature design starts with the smallest viewport. The extension popup, mobile web, and app are the most constrained contexts — design for those first.
- **Sticky header** with `position: sticky` and `1px solid var(--border)` bottom border. Background matches `--background`.

---

## Voice & Copy

### Writing Principles

- **Talk like a person.** Imagine explaining the feature to a friend who's a developer. No marketing speak, no superlatives, no corporate filler.
- **Use "I" not "we."** Hutch is solo-built. "I" is more honest and personal.
- **Be specific over vague.** "Your article is saved" beats "Action completed." "Import your 847 Pocket articles" beats "Migrate your data."
- **Modest language.** Never say "best", "revolutionary", "game-changing", "reimagined". The product speaks for itself.
- **Acknowledge limitations honestly.** "This feature isn't ready yet" is always better than hiding it or over-promising.

### UI Copy Patterns

| Context | Do | Don't |
|---|---|---|
| Empty states | "Nothing saved yet. Hit the extension button on any page to start." | "Wow, it's empty in here!" |
| Confirmations | "Article saved." | "Awesome! Successfully saved to your library!" |
| Errors | "Couldn't save this page. Try again?" | "Oops! Something went wrong" |
| Loading | "Loading your articles..." | "Hang tight! We're fetching your stuff!" |
| Onboarding | "Save articles. Read them later. That's it." | "Welcome to the future of reading!" |

### Tone Rules

- **No emojis in UI.** Emojis are fine in social posts or community replies, never in the product interface.
- **No exclamation marks in confirmations or status messages.** Save those for moments that actually warrant excitement (e.g., "Import complete — 1,247 articles are now in Hutch!").
- **No self-deprecating humour in error states.** Errors are frustrating. Be clear and helpful, not cute.

---

## Platform-Specific Guidance

### Browser Extension

- The toolbar icon is the standalone H mark at 16×16 / 32×32px (see `projects/firefox-extension/src/icons/`).
- The popup should feel like a utility — fast, minimal, single-purpose. Open → save → close. Width: `350px`.
- Respect the user's browser theme. Match system light/dark mode via `prefers-color-scheme`.
- No marketing or upsells inside the extension popup. It's a tool, not a billboard.

### Web App

- The primary reading interface. Design every pixel for long reading sessions.
- Navigation should be quiet and out of the way. The article list and reader view are the product — everything else is supporting cast.
- Keyboard shortcuts for power users. Document them, make them discoverable, but don't require them.
- Default to clean, distraction-free views. Features like tags, search, and filters should be accessible but not visually competing with the reading surface.
- Header uses a transparent variant (`.header--transparent`) on the landing page hero, switching brand text to `--color-on-brand` (white).

### Mobile (Future)

- Touch targets minimum 44×44px.
- The save flow should be possible via share sheet / system share — no need to open the app.
- Offline reading is a first-class feature. Design for it from day one.
- Respect platform conventions (iOS Human Interface Guidelines, Material Design) while maintaining Hutch's visual identity. Don't fight the platform.

### CLI (Future)

- Output should be plain and readable in any terminal emulator.
- Use colour sparingly — stick to the terminal's default palette for compatibility. Amber for highlights if colour is supported.
- Respect `NO_COLOR` environment variable.
- Help text should be concise and follow GNU conventions.

### Email / Newsletters

- HTML emails should use the warm amber palette.
- Keep emails short. One purpose per email, one CTA.
- Always include a plain-text version.
- Sender name: "Fagner from Hutch" (personal, not corporate).

---

## Do's and Don'ts — Quick Reference

### Do

- Lead with the warm amber palette (`--primary` / `--color-brand`).
- Use generous whitespace and spacing.
- Write like a human talking to another human.
- Design for reading comfort above everything.
- Test every UI against both light and dark modes.
- Maintain the quiet, confident, crafted tone.
- Make the product feel fast and lightweight.
- Use the CSS custom properties defined in `base.styles.ts` — never hardcode colour values.

### Don't

- Use pure black, neon colours, or heavy gradients.
- Add emojis, exclamation marks, or playful copy to the product UI.
- Use "we" — Hutch is solo-built; use "I" or speak from the product's perspective.
- Clutter the reading surface with chrome, toolbars, or feature promotions.
- Copy any competitor's visual language (especially Pocket's red or Readwise's yellow).
- Sacrifice legibility for aesthetics.
- Ship something that feels like a startup template.
- Hardcode hex values — always use the CSS custom properties.

---

*Last updated: March 2026*
