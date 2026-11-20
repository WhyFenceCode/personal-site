# Embeds: websites and repositories

Two kinds of object you can place anywhere in Markdown, in blog posts and in project case studies: a website in a
browser frame, and a GitHub repository you can browse. Each one is a single line on its own, and sits exactly where
you write it, between paragraphs and images. Use as many as you like.

They're written as directives (the same idea as Starlight's), so the files stay plain `.md`:

```markdown
Some text about the project.

::site[The docs site, live]{url="https://shaders.properties"}

More text, then an image, then the code:

![The first prototype](./prototype.jpg)

::repo{name="WhyFenceCode/extracurricular-api"}
```

## A website: `::site`

```markdown
::site{url="https://example.com"}
::site[A caption under it]{url="https://example.com"}
::site{url="https://example.com" image="./example.jpg" alt="The home page of example.com"}
::site{url="https://example.com" live="false"}
```

| Part | What it does |
| --- | --- |
| `url="…"` | The website. Required. |
| `[…]` | A caption under the frame. Optional. |
| `image="./file.jpg"` | Your own screenshot, next to the Markdown file. Shown until (or instead of) the live site. |
| `alt="…"` | Describes the screenshot for screen readers. |
| `live="false"` | Never load the real site; just the screenshot. |

**How it behaves.** It's the same frame as at the top of project pages:

- If the website allows being shown in a frame (checked when the site builds), it can load the real site, scaled to
  fit. For any other website, nothing loads until the reader presses **Continue** on a card that says what loading it
  means (that website sees the visit and may set cookies). Your own sites (torstenyoung.com) load straight away.
- If it can't be framed, or `live="false"`, the screenshot is shown, with the address linking to the site.
- With no screenshot and no live site, the frame shows a link to it.

**Screenshots, automatically.** Run `pnpm shots` and every `::site` without an `image="…"` gets a 1440×900
screenshot in `src/assets/screenshots/sites/`, which the frame then uses. Commit the images. `pnpm shots --all`
re-takes them all.

**Privacy.** Every website used in a `::site` is listed automatically in the privacy and cookie policies.

## A repository: `::repo`

```markdown
::repo{name="WhyFenceCode/personal-site"}
::repo[WhyFenceCode/personal-site]
::repo{name="WhyFenceCode/personal-site@dev"}
```

Its file tree on the left, the README on the right; any file opens when clicked, with syntax highlighting and line
numbers, plus a "View on GitHub" link. Like opening the repo on GitHub, in the site's own style. In a narrow column
(like a blog post) the file list folds behind a **Files** button. `@dev` picks a branch; without it, the default branch.

The older form still works too:

````markdown
```repo
WhyFenceCode/personal-site
```
````

**How it works:**

- Everything is fetched **when the site builds**, never by a reader's browser, so reading a page contacts no other
  company. Each file becomes a small page on this site (`/repos/<owner>/<name>/<path>.html`), downloaded only when
  someone opens it.
- **Shown:** text and code up to 100 KB, Markdown files (rendered like the README), images up to 400 KB.
- **Listed, with a link to GitHub instead:** bigger files, binaries (PDFs, models, fonts…), generated files like
  `pnpm-lock.yaml`, and any text files past the first 300.
- **READMEs:** links to other files open in the viewer and the repo's own images show. Images from other websites,
  like shields.io badges, are left out (their alt text stays), again so nothing loads from elsewhere.
- **Public repositories only.** A private or misspelled one shows a plain link to GitHub, and the build log says why.
- **Freshness:** it shows the repo as it was at the last build. The daily rebuild
  ([scheduled-rebuilds.md](../site/scheduled-rebuilds.md)) keeps it current.
- **Speed:** the first build with a new repo downloads its files (up to a minute). After that they're cached in
  `node_modules/.cache/site-repos` by content, so only changed files are fetched again.
- **GitHub's limit:** without a token GitHub allows 60 requests an hour; each repo uses 2 per build, cached for 10
  minutes. If a build ever warns about it, add a `GITHUB_TOKEN` build variable with a token that has no scopes.

## At the top of a project page

Project pages have a wide window under the title. Choose what fills it in the frontmatter:

```yaml
showcase: site    # default: the browser frame with the live site or its screenshot (needs live: or a cover)
showcase: repo    # the repository viewer instead (needs repo: owner/name)
showcase: none    # nothing
```

Everything else goes in the case study with `::site` and `::repo`. See
[projects-and-resume.md](projects-and-resume.md).

## A directive by accident?

Only `::site` and `::repo` mean anything. Anything else that looks like a directive (`TODO:fix` in a sentence, or a
line starting `::`) is left exactly as you wrote it.

## Changing them

- The frame's HTML and the framing check: `src/lib/frame.mjs` · its look: `src/styles/frame.css` · Continue and
  scaling: `src/scripts/frame.ts` · the card's text: `src/i18n/<lang>.yaml` → `projects.preview`
- The repository viewer: `src/lib/repos.mjs` (limits at the top) · `src/styles/repo.css` · `src/scripts/repo.ts`
- Reading the directives: `src/lib/embeds.mjs`
