# Listening

Hand-entered, so it only changes when you want it to.

## Setup
In `src/config/activities.yaml`:

```yaml
listening:
  updated: 2026-10
  nowPlaying: { song: "1/1", artist: Brian Eno }
  topArtists: [Brian Eno, Floating Points, Nils Frahm, Khruangbin, Bonobo]
```

- `nowPlaying` is the "On repeat" record: the song on top, the artist under it. Leave it out to show only the list.
- `topArtists` shows up to five, numbered.
- The record spins while the block is hovered or focused (and stays still with reduced motion).

Change it whenever you like and push; it shows on the next build.
