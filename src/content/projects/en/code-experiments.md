---
title: Code Experiments
year: 2024
kind: Experiments
category: experiments
role: Sole developer
stack: [JavaScript, CSS, three.js, Tauri, Node.js]
summary: Small experiments with layout, motion and graphics.
art: orbit
order: 6
links:
  - { label: Morphing Grid, url: "https://whyfencecode.github.io/ChangingGrid/" }
  - { label: Wallpaper, url: "https://whyfencecode.github.io/Wall-Paper-Test/" }
  - { label: Pixel Render Console GitHub, url: "https://github.com/WhyFenceCode/pixelRenderConsole" }
---
## Why
Small, quick ideas I had, mainly just for fun, though some are now used in other systems I've built. I made many of them while I was learning, or to understand something better.

## The experiments
### Morphing Grid
A page that uses CSS grids to morph its layout. I saw something like it on the web once and felt like making my own. It's now used on [my photo website](https://photos.torstenyoung.com/).

### Wallpaper
An animated wallpaper of coloured parallelograms drifting across the screen at an angle, with today's date on top. I later wrapped it in Tauri to try running it as a desktop app, which worked but didn't do what I wanted.

### Hover Dots
A grid of dots in three.js that ripples as a wave passes across it.

### Pixel Render Console
A small Node.js renderer that draws grids of colours, like heatmaps and QR codes, as coloured pixel art in your terminal, with just one dependency for making the QR codes. It uses true-colour escape codes and the half-block character (▀) so each character cell shows two pixels, one on top of the other, which gives a decent resolution.
