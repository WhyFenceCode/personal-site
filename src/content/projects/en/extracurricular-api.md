---
title: Extracurricular API
year: 2026
kind: Public API
category: open source
role: Sole developer
stack: [Python, JSON, GitHub Actions, GitHub Pages]
summary: A free JSON API of university clubs, design teams and competitions, refreshed every week.
art: ledger
live: "https://whyfencecode.github.io/extracurricular-api/"
repo: WhyFenceCode/extracurricular-api
showcase: repo            # the repository at the top instead of the site
order: 5
metrics:
  - { value: 409, label: activities at Queen's }
links:
  - { label: GitHub, url: "https://github.com/WhyFenceCode/extracurricular-api" }
---
## The problem
I found it hard to find the information I needed, as clubs and extracurriculars are split across many different places, each with its own API and layout.

## What I built
I made a free API, with Claude's help, that gathers all the data from the schools' websites. It then serves static JSON files from GitHub Pages in a way that still allows filtering. It rebuilds itself weekly and currently includes Queen's University, with the option to add more schools. The data includes whether applications are open, meeting times, faculties, whether first years can join, and more. It also regenerates its documentation whenever something changes or a new school is added.
