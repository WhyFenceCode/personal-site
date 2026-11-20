---
title: How to write a post
date: 2026-11-19
summary: A reference for writing posts here. It's a draft, so it only shows in pnpm dev.
tags: [Guide]
draft: true
---

This post is a cheat sheet. It stays a draft, so it shows when you run `pnpm dev` and is never published.

# Where posts live

Each post is a Markdown file in `src/content/blog/en/`. Either:

- one file, `src/content/blog/en/my-post.md`, or
- a folder with the images beside it, `src/content/blog/en/my-post/index.md`.

The file or folder name is the address: `/en/blog/my-post/`. The name `newest` is taken.

## Frontmatter

```yaml
---
title: Starting a blog
date: 2026-11-20          # newest date is the latest post, and what /blog/newest shows
summary: One or two lines for the blog page and link previews.
cover: ./cover.jpg        # optional, next to the file
coverAlt: What the cover shows
tags: [Meta]              # optional, used by the filter on the blog page
draft: true               # optional, only shown in pnpm dev
updated: 2026-12-01       # optional
---
```

# Headings

Write sections with `#` or `##`; both work. The page title is already the top heading, so when a post uses `#`, every heading moves down one level. Each section gets an address and a `#` link on hover, and the list on the left follows along as you scroll.

## A smaller heading

### And a label

Use these sparingly.

# Images

Put the image next to the post and link it with a relative path. It's resized and served as a modern format automatically:

![This site on a tablet](./phone.jpg)

Images in `public/` work too, with a path from the site root: `![Logo](/favicon.svg)`. Images from other websites (`https://…`) stop the build, because loading them would tell that website who is reading: download them instead. Photos are shown in greyscale, as the brand kit asks.

# A GitHub repository

A fenced block in the language `repo`, holding the repository's owner/name, shows its files and README, like opening it on GitHub. It works in project pages too (or set `repo:` in a project's frontmatter):

````markdown
```repo
WhyFenceCode/personal-site
```
````

```repo
WhyFenceCode/personal-site
```

# Links

- Another post, by its file, the same as on GitHub: [Starting a blog](../hello-blog/index.md), or [one of its sections](../hello-blog/index.md#what-to-expect).
- A section of this post: [back to Headings](#headings).
- Anywhere on the site: [projects](/en/projects/).

# Everything else

> Quotes are set large, with an accent rule.

Inline `code`, **bold**, *italics*, lists, tables and code blocks all work.

| Thing | Where |
| --- | --- |
| Posts | `src/content/blog/<lang>/` |
| Text on the blog page | `src/i18n/<lang>.yaml` → `blog` |
