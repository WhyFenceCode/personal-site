---
title: Fusion Foil Builder
year: 2026
kind: Fusion Addon
category: industry software
role: Modify and Expand
stack: [Python, Fusion]
summary: A program to model hydrofoils from spline files.
art: tidal
featured: true
order: 1
links:
  - { label: Source, url: "https://github.com/WhyFenceCode/FoilBuilder" }
---
I am a member of the aquafoil design team, where we are desiging a hydrofoiling boat.

## The problem
Modeling of complex foil geometry from the NACA or DAT splines that define them is very difficult. On top of that making the foil account for all the variables, a turbulence reduction bulb, and mounting for a vertical support is even more difficult.

## What we built
My team lead Thomas Hung built the origional foil generator, with bulb and DAT file options. I then expanded on it, adding the vertical support and vertical support blending into the system, fixing bugs, and overall changing a lot of things to make the system more reliable. Claud helped build this out, fixing bugs and making it overall more usable.