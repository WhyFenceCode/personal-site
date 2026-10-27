# Education, projects and experience

Each entry is one Markdown file inside a language folder. The frontmatter (between the `---` lines) fills the
cards and tables; the body becomes the detail text.

## Education: `src/content/education/en/<name>.md`
```markdown
---
title: BSc Media Informatics
institution: University of Your City
kind: degree            # degree | exchange | certificate | course
start: 2013             # optional
end: 2016
grade: 3.9 GPA          # optional
highlight: Thesis on perceptual image quantisation.   # the one line shown on the home page
featured: true          # featured entries appear on the home page
order: 1                # lower comes first
---
Optional longer description.
```

The home page shows only `featured: true` entries, up to `show` in `home.yaml` (default 2). Everything appears
on the resume page. Degrees also appear on the resume timeline.

## Projects: `src/content/projects/en/<slug>.md`
```markdown
---
title: Orbit
year: 2026
kind: Web app            # label on the card
category: web            # used by the filter buttons on the work page
role: Design & build
stack: [Astro, Three.js]
summary: One sentence for cards and the page intro.
cover: ./orbit.jpg       # optional image next to this file; otherwise placeholder art
featured: true           # featured first on the home page
order: 1
links:
  - { label: Live site, url: "https://example.com" }
---
The case study, in Markdown. Headings, lists, images and tables all work.
```
The file name becomes the URL: `orbit.md` → `/en/work/orbit/`.

## Experience: `src/content/experience/en/<slug>.md`
```markdown
---
company: Studio Nord
role: Senior Product Designer
location: Remote
start: 2023-03
end: 2025-06            # leave out for a current role ("Now")
tags: [Product, Systems]
---
- One achievement per bullet.
- The first bullet is also shown on the resume timeline.
```

## Translations
Add the same file name under `de/` (or any language in `site.yaml`). Missing translations fall back to the
default language automatically, so you can translate gradually.
