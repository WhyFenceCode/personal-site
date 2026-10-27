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
courses: [Physics I, Calculus I]   # optional: "Relevant courses" chips on the home page and resume
---
Optional longer description.
```

The home page shows only `featured: true` entries, up to `show` in `home.yaml` (default 2). Everything appears
on the resume page. Degrees also appear on the resume timeline.

### Certifications
Certificates and short courses are education entries too, with `kind: certificate` (or `course`). They get their
own **Certifications** section on the home page (hidden until there's at least one) and their own list on the
resume page:

```markdown
---
title: Web Accessibility Specialist
institution: IAAP
kind: certificate
end: 2026-05
url: https://www.credly.com/badges/…   # optional: a "Verify" link to the credential
---
```

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
cover: ./orbit.jpg       # optional image next to this file; otherwise the live-site screenshot, then placeholder art
live: https://example.com   # optional: "Visit the site" button, screenshot cover and live preview
preview: true            # set false to never offer the interactive live preview
client: Example Club     # optional facts shown beside the write-up
services: [Design, Development]
metrics:                 # optional big numbers above the write-up
  - { value: 97, label: "Lighthouse performance" }
  - { value: 3, label: "Teams updated automatically" }
featured: true           # featured first on the home page
order: 1
links:
  - { label: Live site, url: "https://example.com" }
---
The case study, in Markdown. Headings, lists, images and tables all work.
```
The file name becomes the URL: `orbit.md` → `/en/work/orbit/`.

### Live sites: screenshots and the interactive preview
- Run `pnpm shots` after adding a project with `live:`. It opens the site in a headless browser and saves a
  1440×900 screenshot to `src/assets/screenshots/<slug>.jpg`, which becomes the cover. Commit the image.
  `pnpm shots --all` re-captures every project; `pnpm shots <slug>` re-captures one.
- On the project page the screenshot sits in a browser frame. If the live site allows being framed, a
  **Load live site** button swaps in the real, interactive site. Nothing from that site loads until the click.
- Whether a site can be framed is checked at build time from its `X-Frame-Options` and `Content-Security-Policy`
  headers. To allow it for a site you control, have it send:
  `Content-Security-Policy: frame-ancestors 'self' https://torstenyoung.com` and remove `X-Frame-Options: DENY`.

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
