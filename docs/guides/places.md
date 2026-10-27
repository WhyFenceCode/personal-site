# Places

A world map with a pin for each place you've been, the countries filled in, and a count. Drawn as a static
image at build time: no map service or tiles load in visitors' browsers.

## The file: `src/data/places.txt`
```text
Lisbon, Portugal | 2024 | First film camera
Tokyo, Japan | 2023
Reykjavik, Iceland
```

`City, Country | year | note`. Year and note are optional. The note shows when someone hovers the pin.

## How the coordinates are found
At build time each new place is looked up once on OpenStreetMap (Nominatim) and saved in
`src/data/places.cache.json`. **Commit that file**, so later builds don't look anything up again.

If a lookup lands in the wrong spot (there are many Springfields), pin it yourself:

```text
Springfield, United States | 2024 | @39.80,-89.64
```

To redo a lookup, delete its line from `places.cache.json`.

## Privacy
Stick to cities. Don't add a home address or anything more precise than a town: the cache file and the map are
public.

## The same lookup sets your clock
The hero clock's time zone comes from `location.city` in `site.yaml` when `timezone: auto`. If it guesses
wrong, set it directly, e.g. `timezone: America/Toronto`.

## Size
In `home.yaml`, `{ id: places, size: 4 }` gives it a full row; `size: 2` works but the map gets small.
