# Design System & UI Specifications

Utilitarian, technical, and high-density design system engineered to eliminate generic AI aesthetics. Inspired by the clarity and craft of Linear, Vercel, and Stripe.

---

## 1. Aesthetic Direction

- **Core Character:** Utilitarian, technical, and high-contrast minimalism. Every pixel serves functional clarity and rapid information scanning.
- **Information Density:** High density over airy decorative whitespace. Data and controls are grouped closely with crisp visual boundaries.
- **Surface Elevation:** Depth is achieved via subtle background shade shifts and crisp `1px` borders, rather than soft, diffuse drop-shadows.
- **Zero Decorative Slop:** No gratuitous multi-color gradients, no neon drop glows, no blurred backdrop blobs, no sparkle icons, and no decorative mesh canvas backgrounds.

---

## 2. Semantic Color System

All components must strictly use semantic color tokens. Hardcoded HEX, RGB, or HSL color values are prohibited in component code.

### 2.1 Color Tokens Specification

| Token | Role | Light Mode Value | Dark Mode Value |
| :--- | :--- | :--- | :--- |
| `background` | Page canvas background | `#ffffff` | `#09090b` |
| `foreground` | Primary high-contrast text | `#09090b` | `#f4f4f5` |
| `card` | Surface background for cards/panels | `#ffffff` | `#111113` |
| `card-foreground` | Content inside cards/panels | `#09090b` | `#f4f4f5` |
| `popover` | Dropdowns, menus, tooltips | `#ffffff` | `#111113` |
| `popover-foreground` | Content inside popovers | `#09090b` | `#f4f4f5` |
| `muted` | Subtle background for table headers, hover, active | `#f4f4f5` | `#18181b` |
| `muted-foreground` | Secondary helper text, captions, timestamps | `#71717a` | `#a1a1aa` |
| `border` | Structural 1px dividers, card & input borders | `#e4e4e7` | `#27272a` |
| `input` | Input field border & container background | `#e4e4e7` | `#27272a` |
| `accent` | Secondary interactive hover/subtle focus tint | `#f4f4f5` | `#27272a` |
| `accent-foreground` | Text on accent surfaces | `#18181b` | `#fafafa` |
| `primary` | Single restrained primary CTA & active indicator | `#18181b` | `#fafafa` |
| `primary-foreground` | Text on primary button/badge | `#fafafa` | `#18181b` |
| `destructive` | Danger actions, destructive states | `#dc2626` | `#ef4444` |
| `destructive-foreground`| Text on destructive surfaces | `#fafafa` | `#fafafa` |
| `ring` | Crisp focus indicator ring | `#18181b` | `#d4d4d8` |

### 2.2 Token Rules
1. **Single Restrained Accent:** The interface relies primarily on monochromatic contrast (`foreground` vs `background`) with a single crisp accent.
2. **Never Use Arbitrary Values:** Never write classes such as `bg-[#13141f]` or `text-[#3b82f6]`. Use semantic tokens: `bg-background`, `text-muted-foreground`, `border-border`.

---

## 3. Typography System

### 3.1 Font Families
- **Interface / Sans:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, `sans-serif`. Used for all body text, headings, and labels.
- **Technical / Monospace:** `"JetBrains Mono"`, `"Geist Mono"`, `ui-monospace`, `SFMono-Regular`, `Menlo`, `monospace`. Mandatory for:
  - Tabular numeric data (`tabular-nums font-mono`)
  - Code snippets, hashes, IDs, and API keys
  - Version tags, release badges, and timestamps
  - System metrics and resource gauges

### 3.2 Type Scale & Hierarchy

| Scale | Tailwind Class | Size / Line-height | Usage |
| :--- | :--- | :--- | :--- |
| **Hero / Page Title** | `text-2xl font-semibold tracking-tight` | `24px / 32px` | Main page heading |
| **Section Title** | `text-lg font-medium tracking-tight` | `18px / 26px` | Card/panel header, section title |
| **Subsection / Group** | `text-sm font-medium` | `14px / 20px` | Table headers, list grouping, form section |
| **Body (Default)** | `text-sm font-normal` | `14px / 20px` | Primary content, inputs, table cells |
| **Muted / Secondary** | `text-xs font-normal text-muted-foreground` | `12px / 16px` | Helper notes, metadata, secondary labels |
| **Technical Label** | `text-xs font-mono tabular-nums` | `12px / 16px` | Counters, badges, timestamps, status codes |

### 3.3 Text Alignment
- **Left-aligned by default:** All headings, paragraphs, descriptions, and form controls must be left-aligned.
- **Center-alignment restriction:** Only permitted for short empty-state banners or compact modal headers. Never center entire feature descriptions or body copy.

---

## 4. Borders, Geometry & Elevation

- **Borders over Shadows:** Structure surfaces using crisp `1px solid` borders (`border border-border`). Diffuse heavy drop-shadows (`shadow-xl`, `shadow-2xl`) are strictly avoided.
- **Allowed Shadows:** Only subtle elevation for floating overlays (`shadow-sm` on dropdowns and modals to separate them from underlying surfaces).
- **Radius Scale:**
  - `rounded-sm` (`2px` - `4px`): Badges, inline code blocks, small status chips.
  - `rounded-md` (`6px`): Buttons, input fields, selects, dropdown menus.
  - `rounded-lg` (`8px`): Cards, dialog modals, structured panels.
  - **Forbidden:** No oversized pill buttons (`rounded-full` on standard action buttons is disallowed; reserved solely for circular avatar fallbacks and compact status dots). No swollen cards (`rounded-2xl` or `rounded-3xl`).

---

## 5. Spacing, Layout & Grid Architecture

### 5.1 Predictable 4px / 8px Grid
- Padding and margins must follow standard 4px increments:
  - Micro-spacing: `gap-1` (4px), `gap-1.5` (6px), `gap-2` (8px)
  - Control-spacing: `px-3 py-1.5` (button/input standard), `p-4` (card interior standard)
  - Layout-spacing: `gap-4` (16px), `gap-6` (24px), `space-y-6` (page section spacing)
- No odd arbitrary spacing values (`p-[13px]`, `mt-[27px]`).

### 5.2 Functional Layouts vs. Generic Clichés
- **Asymmetry & Utility:** Group related controls and metrics into dense sidebars, master-detail layouts, or data tables.
- **Forbidden Cliché:** The uniform "3-column card grid where every card has a colored circle icon at the top, a bold title, and 2 lines of muted text" is strictly prohibited. Use structured lists, dense tables, or split master-detail views instead.

---

## 6. Component Guidelines

### Buttons & Actions
- Height: Compact (`h-8` or `h-9` for standard actions; `h-7` for micro table actions).
- Padding: `px-3 py-1.5` with `text-sm font-medium`.
- States: Clear, immediate hover shift (`hover:bg-accent hover:text-accent-foreground`), crisp focus ring (`focus-visible:ring-1 focus-visible:ring-ring`).

### Input Fields & Controls
- Height: Exactly matching buttons (`h-8` or `h-9`).
- Borders: Crisp `1px` (`border-input`), background `bg-background` or `bg-muted/50`.
- Text: `text-sm`, placeholder `text-muted-foreground`.

### Badges & Status Indicators
- Structure: Minimal padding (`px-2 py-0.5`), `text-xs font-mono font-medium`, `border border-border`.
- Status dots: 6px solid circle with semantic status color, avoiding glowing halos.

### Data Tables & Lists
- Table headers: `text-xs font-medium text-muted-foreground uppercase tracking-wider` with `bg-muted/50`.
- Cells: `py-2 px-3 text-sm border-b border-border`.
- Numeric columns: Right-aligned with `font-mono tabular-nums`.
