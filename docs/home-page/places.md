# Places

A globe made of small dots that visitors drag to spin, with a count of places and countries. Countries you've been
to are a darker shade (hover one for a card), each place is a larger dot, and clicking a place (on the globe or in
the list beside it) turns it accent and turns the globe to face it. The dots are worked out when the site builds and
the globe is drawn in the browser from them: no map service or tiles load in visitors' browsers.

## The file: `src/data/places.txt`
```text
Lisbon, Portugal | 2024 | First film camera
Tokyo, Japan | 2023
Reykjavik, Iceland
```

`City, Country | year | note`. Year and note are optional. The note shows in the place's card.

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

## On the home page
Places is a section of its own in `home.yaml` (`- type: places`), not a hobby block. Move it like any other section
([sections.md](sections.md)); `tone: light` keeps the globe easy to read.
