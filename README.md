# PulseDeck Playlist Feed

Daily JSON feed for public Spotify editorial playlists. This is derived from the SyncList prototype, but strips the app, database, and UI so PulseDeck can consume plain JSON from GitHub.

## Files

- `sources/playlists.json` is the curated list of 20 public Spotify playlists.
- `scripts/build-feed.mjs` fetches Spotify metadata/tracks and writes JSON.
- `data/index.json` is the lightweight card list for PulseDeck.
- `data/playlists/{slug}.json` is the full playlist data.
- `data/changes/latest.json` shows the latest added/removed tracks.

## GitHub setup

Add these repository secrets:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

The workflow runs daily at `06:17 UTC` and can also be run manually from GitHub Actions.

## Local commands

```bash
npm run validate
npm run generate
```

`npm run generate` needs Spotify credentials in the environment.
