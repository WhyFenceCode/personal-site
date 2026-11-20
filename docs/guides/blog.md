# Blog

Posts are Markdown files. The blog page lists them newest first, each post gets its own page, and
`/blog/newest` always shows the latest one.

| Address | What it shows |
| --- | --- |
| `/en/blog/` | The latest post large, then every other post with a tag filter |
| `/en/blog/<slug>/` | One post |
| `/en/blog/newest/` (or just `/blog/newest`) | The latest post, at an address that never changes |

## 1. Create the file

Pick a short slug in lowercase with hyphens. It becomes the address. Then either:

- **One file:** `src/content/blog/en/my-first-build.md`, or
- **A folder**, when the post has images: `src/content/blog/en/my-first-build/index.md` with the images beside it.

The slug `newest` is taken; the build stops with a message if you use it.

## 2. Add the frontmatter

At the very top of the file:

```yaml
---
title: My first build
date: 2026-11-20
summary: One or two lines. Shown on the blog page and in link previews.
---
```

Optional fields:

| Field | Example | What it does |
| --- | --- | --- |
| `cover` | `./cover.jpg` | Image at the top of the post and on the blog page. Put it next to the file. |
| `coverAlt` | `The hull on the bench` | Describes the cover for screen readers. |
| `tags` | `[Sailing, Hardware]` | Shown on the post; the blog page can filter by them. |
| `draft` | `true` | Only shows in `pnpm dev`. Never published. |
| `updated` | `2026-12-02` | Adds an "Updated" date under the title. |

The `date` decides the order. The newest date is the "latest" post and what `/blog/newest` shows. Post numbers
(No. 1, No. 2…) are given in date order, oldest first.

## 3. Write the post

Normal Markdown below the frontmatter.

### Headings

Use `#` or `##` for sections and `###` below that. The page title is already the top heading, so if you use `#`,
every heading moves down one level automatically. Each section:

- gets an address you can link to, like `/en/blog/my-first-build/#the-hull`
- shows a `#` link when you hover it
- appears in the "On this page" list beside the post (when there are two or more)

### Images

| You write | Where the file is |
| --- | --- |
| `![The hull](./hull.jpg)` | Next to the post (use the folder layout). Resized and converted automatically. |
| `![Logo](/logo.svg)` | In `public/` |

Always write the alt text (the part in square brackets). Photos show in greyscale, per the brand kit.

Images from other websites (`https://…`) aren't allowed: the build stops and says which one. Loading them would
send visitors' details to that website, which the privacy policy promises never happens. Download the image and put
it next to the post instead.

### Links

| You write | Goes to |
| --- | --- |
| `[the last post](../my-first-build/index.md)` | Another post, by its file (works on GitHub too) |
| `[that part](../my-first-build/index.md#the-hull)` | A section of another post |
| `[see above](#the-hull)` | A section of this post |
| `[projects](/en/projects/)` | Any page on the site |

## 4. Check it

```bash
pnpm dev
```

Open http://localhost:4321/en/blog/. Drafts show here too. The draft post `writing-posts` shows every feature
in use, so copy from it when unsure.

## 5. Publish

Set `draft: false` (or remove the line), commit and push. The site rebuilds, the post appears at the top of the
blog page, and `/blog/newest` moves to it.

## Changing the blog page text

The labels ("Latest", "min read", the blog page lead…) are in `src/i18n/<lang>.yaml` under `blog:`.
