---
title: Fusion Foil Builder
year: 2026
kind: Fusion Add-on
category: industry software
role: Modify and Expand
stack: [Python, Fusion]
summary: A program to model hydrofoils from spline files.
art: tidal
model: /models/foil-builder.glb
modelAngle: { turn: 54, tilt: 26 }
featured: true
order: 1
links:
  - { label: Geometry Generator GitHub, url: "https://github.com/WhyFenceCode/FoilBuilder" }
  - { label: Layup Planner GitHub, url: "https://github.com/WhyFenceCode/FoilLayup" }
---
## The problem
Modeling complex foil geometry from the NACA or DAT splines that define it is a complex and time-consuming process. The addition of drag reduction bulbs, flaps, and other geometry further exacerbates this. The foil geometry also needs to be split into composite layers to allow for finite element analysis, core machining, and layup cut template generation.

## What we built
To solve this, two new Fusion add-ons were made, allowing this workflow to be rapidly automated and parameterized. The first is a geometry generator that takes spline profiles and generates complete foil geometries for fluid simulation. The second is a system that allows you to assign a layup from a library of materials, and then splits the geometry body into its layers.

### Geometry Generator
My team lead [Thomas Hung](https://www.thomashung.space/) built the original foil generator, with bulb and DAT file options. I then expanded on it, adding the vertical support and its blending into the system, fixing bugs, and changing a lot of things overall to make the system more reliable. Claude helped build this out, fixing bugs and making it overall more usable. From there it was taken over by one of the other CFD team members.

### Layup Planner
I worked with common materials, as well as the sustainable ones we expected to use in the [SuMoth Challenge](https://sumoth.org/), to make a standard library that anyone using the tool can draw from. Claude helped generate a custom Fusion UI allowing the user to render a preview of the foil cross-section after they set their layup. The tool can then generate the final meshes over a period of around 20 minutes. Still in progress is the system's ability to unwrap geometry so that it can be cut from the composite mat.