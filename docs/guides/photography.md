# Photography

No photos are shown on this site. There are two ways to point people to your photo site.

## 1. The link card (in the hobbies section)
`src/config/activities.yaml`:

```yaml
photography:
  url: "https://photos.example.com"
  label: See the photographs
  description: Film and digital, mostly cities at the edges of the day.
  meta: Film · Digital           # small label top-right
```

The whole card is the link. Remove `url` (or the block from `home.yaml`) to hide it.

## 2. The banner (top of the page)
`src/config/site.yaml`:

```yaml
banner:
  enabled: true        # false = no banner anywhere
  pages: home          # home | all
  text: I also take photographs.
  label: Visit the photo site
  url: "https://photos.example.com"
  dismissible: true    # adds a close button; it stays closed while browsing and returns on the next visit
```

The hero shrinks by the banner's height so the name still fits on the first screen.

The banner works for any announcement, not just photography.
