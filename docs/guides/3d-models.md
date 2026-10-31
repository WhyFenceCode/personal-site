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

Run `pnpm dev` and open the project page. The model appears under the screenshot/live preview. Drag to spin it.

## Troubleshooting
| Problem | Fix |
| --- | --- |
| "Couldn't load /models/…" under the model area | Check the path in `model:` matches the file in `public/models/` |
| Model is tiny, huge or off-centre | The viewer centres and frames it automatically; if it's still odd, apply scale and rotation in Blender (**Ctrl+A → All Transforms**) before exporting |
| Looks flat or black | Give it a material in Blender before export; the default grey works but metal looks better |
| Page feels slow | The file is too big: decimate in Blender and run the optimize command again |
