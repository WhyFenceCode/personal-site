# 3D models on project pages

A project page can show a 3D model you can drag to spin (it also turns gently as you scroll). It's lit like the
hero's chrome letters, with an accent rim light. Nothing shows until you add a model, so this is safe to leave
until the design is final.

## 1. Export from Fusion
The web uses **glTF** (`.glb`). Fusion doesn't export that directly, so go through Blender (free):

1. In Fusion: **File → Export**, type **FBX** (or OBJ). Export only the bodies you want to show; hide internal
   parts, fasteners and sketch geometry first.
2. In Blender: **File → Import → FBX**. Check the size and orientation (the foil should sit level). Delete anything
   you don't want shown, and apply a material if you like (a metal with roughness ~0.2 looks good with the lighting).
3. **File → Export → glTF 2.0**, format **glTF Binary (.glb)**, with **Apply Modifiers** ticked.

## 2. Make it small
Models load on the page, so keep them under ~2 MB. Shrink and compress with one command (nothing to install):

```bash
pnpm dlx @gltf-transform/cli optimize foil.glb public/models/foil.glb --compress meshopt --texture-compress webp
```

`meshopt` compression is understood by the site's viewer. If the model is still large, reduce the triangle count in
Blender first (**Modifiers → Decimate**, ratio 0.3–0.5 rarely shows).

## 3. Add it to the project
Put the file in `public/models/`, then add one line to the project's Markdown frontmatter:

```yaml
model: /models/foil.glb
```

Run `pnpm dev` and open the project page. The model sits pinned on the right while the story scrolls on the left.
Drag to spin it (and up/down to tip it). On the projects page, the project's card shows a dithered still of the model
that turns smooth on hover.

## 4. Point it the right way (optional)
The card shows the model from one fixed angle, and the project page's viewer starts there too. If your model faces
away or sideways, set the angle in the frontmatter, in degrees:

```yaml
modelAngle: { turn: 54, tilt: 26 }
```

- `turn` spins it around the vertical axis. Try steps of 90 (e.g. `-126`, `144`) to find the side you want facing
  you, then fine-tune. Positive turns it anticlockwise as seen from above.
- `tilt` tips the top towards you so you look down on it a little. `0` is level, `26` is the default.

The card always centres and sizes whatever the camera sees at that angle, so you only pick the angle, not the
framing.

## Troubleshooting
| Problem | Fix |
| --- | --- |
| "Couldn't load /models/…" under the model area | Check the path in `model:` matches the file in `public/models/` |
| Model is tiny, huge or off-centre | The viewer centres and frames it automatically; if it's still odd, apply scale and rotation in Blender (**Ctrl+A → All Transforms**) before exporting |
| Card shows the back or side of the model | Change `turn` in `modelAngle` (step 4) |
| Looks flat or black | Give it a material in Blender before export; the default grey works but metal looks better |
| Page feels slow | The file is too big: decimate in Blender and run the optimize command again |
