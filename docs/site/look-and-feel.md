# Look and feel

The switches for how the site looks and moves, all in `src/config/site.yaml`. The rules behind the design (type,
colour, spacing, motion) are in the [brand kit](/en/docs/brand/).

## Colour and type

```yaml
theme:
  accent: "#7E76D0"   # the one accent colour, a 6-digit hex
  accentCursor: false # the cursor dot turns accent over links and buttons
  logoDot: true       # an accent full stop after the name in the header
  headingEcho: true   # an accent outline copy behind section headings, drifting with the pointer
  ink: smooth         # smooth | blotch (below)

typography:
  numbers: outline    # serif | outline: big numbers (education years, stats, the counting intro)
  headings: display   # display | serif | outline: section and page titles
```

The accent is used sparingly: focus rings, text selection, live dots, the cursor in the intro and in build mode, the
GitHub calendar's busiest days. Where the page inverts colours (the header, the name block's bars), anything in the
accent is turned back to the accent rather than its opposite, and selected text shows a grey wash there.

## Ink

The ink is the dark blob that opens the site, covers the screen between pages, and trails the pointer over the name.

| `theme.ink` | Looks like |
| --- | --- |
| `smooth` | Smooth, rolling edges, like ink flowing in water |
| `blotch` | Broken, speckled edges, like ink bleeding into paper |

## The intro

Plays on each fresh open of the site (a new tab, a reload), not when moving between pages. Skipped entirely with
reduced motion or motion off, and it always has a Skip button.

```yaml
features:
  loader: true          # false: no intro at all
  loaderStyle: console  # count | console
```

| `loaderStyle` | What happens |
| --- | --- |
| `count` | A big number counts to 100 while the ink grows in the middle, then the ink opens the page |
| `console` | "Welcome to torstenyoung.com" types out with a purple block cursor while steps tick off with `[ok]`, then the ink spreads from the cursor |

The welcome line is `loader.welcome` in `src/i18n/<lang>.yaml` (`{host}` is the site's address); the steps are
`loader.steps`.

## Moving between pages and the cursor

```yaml
features:
  pageTransitions: true # ink covers the screen from where you clicked and opens the next page
  cursorRing: true      # the mouse pointer becomes a dot that inverts what's under it, growing over links
```

The system cursor comes back over embedded websites and whenever the visitor's system asks for high or increased
contrast.

## Interactive extras

Each can be switched off on its own. Anything that moves also stops when a visitor turns motion off (footer) or has
reduced motion set on their device.

```yaml
interactive:
  build: true      # /build: cursors build the home page live (Shift+B, or the hint on the home page)
  tiltCards: true  # cards tilt toward the pointer
  record: true     # drag the Listening record to spin it
  magnetic: true   # main buttons lean toward the pointer
  depth: true      # headings and numbers drift at slightly different speeds as you scroll
  sheen: false     # a faint light follows the pointer
  pageTilt: true   # pages tilt in 3D as they change
  wind: false      # marquee words lean with scroll speed
  githubCity: false # a "3D" switch on the GitHub calendar
  signature: true  # the name drawn as a signature in the contact section
```

**Build mode** (`/en/build/`): a crowd of purple cursors draws the home page as wireframes, then types its text in
with a solid purple block cursor the height of the line.

## The name block

The layers you dive through by dragging across the name, and their autoplay, are in `src/config/hero.yaml`.
