# JalNiti AI — Design System

## 1. Colour Palette

### Primary Brand Colours

| Name | Hex | Usage |
|------|-----|-------|
| Navy Blue | `#12306b` | Primary actions, headings, chart lines |
| Saffron Orange | `#ff9933` | Accent, inflow bars, warning indicators |
| White | `#ffffff` | Page background, card background |
| Off-white | `#f5f7fb` | Page/sidebar background |

### Semantic / Status Colours

| Name | Hex / CSS Var | Usage |
|------|--------------|-------|
| Success Green | `#2e7d32` / `--ok` | Success messages, pass badges |
| Warning Amber | `#f57c00` / `--warn` | Caution alerts, moderate scarcity |
| Error Red | `#d32f2f` / `--err` | Errors, critical alerts, FAIL badges |
| Info Blue | `#1565c0` / `--info` | Informational messages |

### Scarcity Stage Colours

| Stage | Name | Colour |
|-------|------|--------|
| 0 | Normal supply | `#2e7d32` (green) |
| 1 | Conservation advisory | `#689f38` (light green) |
| 2 | Mild reduction | `#f9a825` (amber) |
| 3 | Time-window rationing | `#f57c00` (orange) |
| 4 | Severe restriction | `#d32f2f` (red) |
| 5 | Emergency (protected minimum) | `#7b1fa2` (purple) |

Referenced in CSS as `--s0` through `--s5`.

---

## 2. Typography

### Font Stack

```css
font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
```

- **Inter** is the primary UI font (loaded from Google Fonts or bundled)
- System fonts as fallback for performance

### Type Scale

| Element | Size | Weight | Usage |
|---------|------|--------|-------|
| Page title | `1.6rem` | 700 | `<Page title="">` |
| Page subtitle | `0.9rem` | 400 | `<Page sub="">` |
| Card title | `1rem` | 600 | `<Card title="">` |
| KPI value | `1.5rem` | 700 | `<Kpi value="">` |
| KPI label | `0.78rem` | 400 | `<Kpi label="">` |
| Body text | `0.9rem` | 400 | General content |
| Table header | `0.8rem` | 600 | `<th>` |
| Small / sub | `0.78rem` | 400 | `.sub` class |
| Code / equation | `0.85rem` | 400 | `<code className="eq">` |

---

## 3. Layout

### Page Structure

```
┌──────────────────────────────────────────────────────┐
│  Sidebar (200px fixed)  │  Main content area          │
│  ─────────────────────  │  ─────────────────────────  │
│  Logo + App name        │  <Page title="" sub="">     │
│  Nav links              │    <Kpi> grid               │
│  User info + logout     │    <Card> sections          │
└──────────────────────────────────────────────────────┘
```

### Grid System

- `.grid.g2` — 2-column responsive grid
- `.grid.g4` — 4-column responsive grid (KPI cards)
- Grids collapse to 1 column on narrow screens

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--gap` | `16px` | Standard card gap |
| Card padding | `20px` | Inside each card |
| Page padding | `24px 32px` | Main content area |
| KPI margin | `18px bottom` | Below KPI grid |

---

## 4. Component Styles

### Buttons

```css
.btn {
  background: #12306b;
  color: #fff;
  border-radius: 6px;
  padding: 8px 18px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}
.btn:hover { background: #0e245c; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
```

### Cards

- White background, `border-radius: 10px`, subtle box shadow
- Title in a slightly darker band at top
- Content padding 16px

### Message Banners (`.msg`)

| Class | Background | Border | Text |
|-------|-----------|--------|------|
| `.msg.err` | `#fdecea` | `#d32f2f` | Red |
| `.msg.ok` | `#e8f5e9` | `#2e7d32` | Green |
| `.msg.info` | `#e3f2fd` | `#1565c0` | Blue |
| `.msg.warn` | `#fff3e0` | `#f57c00` | Orange |

### Badges

- `.badge.pass` — green background, white text
- `.badge.fail` — red background, white text

### Zone Cards (`.zt`)

- Left border color = scarcity stage color
- Protected zones (hospital, essential industry) get gold/amber badge
- Hover: slight box-shadow lift

---

## 5. Icon & Logo

- **App name:** JalNiti AI (जलनीति)
- **Logo concept:** Water droplet + data chart fusion, navy blue
- **Favicon:** Water droplet icon
- No external icon library — use Unicode symbols or inline SVG for any icons needed

---

## 6. Accessibility

- All interactive elements are keyboard-focusable
- Color is never the only indicator (text labels accompany all stage colors)
- Contrast ratios: all text on white backgrounds meets WCAG AA (≥ 4.5:1)
- Form inputs have associated `<label>` elements with `htmlFor`

---

## 7. Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 768px | Sidebar collapses, single column |
| Tablet | 768px–1024px | 2-column grids |
| Desktop | > 1024px | Full layout with sidebar |
