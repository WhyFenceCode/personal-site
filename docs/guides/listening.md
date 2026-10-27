# Listening

Hand-entered, so it only changes when you want it to.

## Setup
In `src/config/activities.yaml`:

```yaml
listening:
  updated: 2026-10
  nowPlaying: { title: "1/1", artist: Brian Eno, album: Music for Airports }
  topArtists: [Brian Eno, Floating Points, Nils Frahm, Khruangbin, Bonobo]
```

- `nowPlaying` is the "On repeat" record. Leave it out to show only the list.
- `topArtists` shows up to five, numbered.
- The record spins while the block is hovered or focused (and stays still with reduced motion).

## Possible upgrade: Last.fm (not built)
If you ever want it automatic without it changing too often, the safest option is Last.fm's **top artists for
the past month**, fetched at build time. It needs a free Last.fm API key (stored as a build secret, see
[scheduled-rebuilds.md](scheduled-rebuilds.md)) and your Last.fm username, and works with Spotify, Apple Music
and most players through scrobbling. Ask and it can be added with `source: lastfm`, keeping the hand-entered
values as the fallback.

Spotify's own API is a poorer fit: "now playing" needs a live server and an access token that refreshes hourly,
which is more moving parts than a static site needs.
