# Languages and Uses

Both are hand-entered in `src/config/activities.yaml`.

## Languages
```yaml
languages:
  items:
    - { name: English, level: 5, note: Native }
    - { name: French, level: 3, note: Intermediate }
```
`level` fills 1–5 squares; `note` is the word shown beside it (and read out to screen readers).

These are the languages you speak. The languages the *site* is available in are separate: `languages` in
`site.yaml`.

## Uses (optional, off by default)
```yaml
uses:
  groups:
    - name: Desk
      items: [MacBook Pro 14", LG UltraFine 5K, Keychron Q1]
    - name: Software
      items: [Figma, VS Code, Raycast]
```

Turn it on in `src/config/home.yaml` by uncommenting:
```yaml
- { id: uses, size: 2 }
```

Any number of groups; they arrange themselves in columns.
