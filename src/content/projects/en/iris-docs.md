---
title: Iris Shader Docs
year: 2024
kind: Documentation site
category: open source
role: Original builder / Core contributor
stack: [Astro, Starlight, MDX, GLSL]
summary: The documentation site for Iris, the Minecraft shader mod, used to learn and build shader packs.
art: meridian
live: "https://shaders.properties"
featured: true
order: 3
metrics:
  - { value: 121, label: commits }
  - { value: 3rd, label: of 18 contributors }
links:
  - { label: Docs GitHub, url: "https://github.com/IrisShaders/docs" }
  - { label: Iris, url: "https://irisshaders.dev" }
---
## The problem
[Iris](https://irisshaders.dev) is one of the most popular shader mods for Minecraft, and its main repository has close to 4,000 stars on GitHub. Writing a shader pack for it meant piecing information together from scattered sources, without one place that explained how a pack is put together or what each uniform does.

## What we built
I built the first version of the site in April 2024 with Astro's Starlight, starting in my own repository before it moved into the Iris organization. I set up its structure and wrote the first reference pages for the uniforms that shaders can read.

Since then I've kept working on it alongside the Iris team. I wrote the welcome and introduction pages, added more uniforms to the reference, rebuilt the 404 page to be more helpful, added a list of shader packs that work with Distant Horizons, and set up a multi-sidebar plugin along with the first overview page for Aperture, the team's new shaders mod.

Recently I have stepped back a bit, allowing the team to continue maintaining the site, which is still hosted publicly at [shaders.dev](https://www.shaders.dev/)