# GitHub repositories (code viewer)

Show a public GitHub repository on a project page or in a blog post: its file tree on the left, the README on the
right, and any file opens when clicked, with syntax highlighting and line numbers. Like opening the repo on GitHub,
but in the site's own style.

## On a project page

Add one line to the project's frontmatter in `src/content/projects/en/<project>.md`:

```yaml
repo: WhyFenceCode/extracurricular-api
```

The viewer appears under the case study, full width, headed "Source code".

## Anywhere in Markdown (blog posts, case studies)

Write a fenced code block in the language `repo` with the repository inside:

````markdown
```repo
WhyFenceCode/personal-site
```
````

It shows up exactly where the block is. On GitHub the file still reads as a plain code block.

## What you can write

| You write | Shows |
| --- | --- |
| `owner/name` | The default branch |
| `owner/name@dev` | The `dev` branch |
| `https://github.com/owner/name` | The same as `owner/name` |

Only **public** repositories work. A private or misspelled one shows a plain link to GitHub instead, and the build
says why.

## How it works, and what it costs

- Everything is fetched **when the site builds**, never by a visitor's browser, so the privacy policy's promise holds:
  reading a page contacts no other company. Each file becomes a small page on this site
  (`/repos/<owner>/<name>/<path>.html`) that's only downloaded when someone opens it.
- **Shown:** text and code up to 100 KB, Markdown files (rendered, like the README), and images up to 400 KB.
- **Listed but not shown** (a link to GitHub instead): bigger files, binaries (PDFs, models, fonts…), and generated
  files like `pnpm-lock.yaml`. At most 300 text files per repo get pages.
- **READMEs:** links to other files open in the viewer; the repo's own images are shown. Images from other websites,
  such as shields.io badges, are left out (their alt text stays), again so nothing loads from elsewhere.
- **Freshness:** the viewer shows the repo as it was at the last build. Scheduled rebuilds
  ([scheduled-rebuilds.md](scheduled-rebuilds.md)) keep it current.
- **Speed:** the first build with a new repo downloads its files, which can take a minute. After that they're cached in
  `node_modules/.cache/site-repos` by content, so only changed files are fetched again.
- **GitHub's limit:** without a token, GitHub allows 60 API requests an hour, and each repo uses 2 per build (cached
  for 10 minutes). That's plenty normally. If a build ever warns about it, add a `GITHUB_TOKEN` build variable with a
  token that has no scopes at all (public data only).

## Changing it

- The viewer's HTML and the limits: `src/lib/repos.mjs`
- Its look: `src/styles/repo.css`
- Opening files, the phone layout: `src/scripts/repo.ts`
- The "Source code" heading: `src/i18n/<lang>.yaml` → `projects.source`
