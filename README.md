# PulseDeck Discovery Feed

Daily JSON discovery feed for public music playlists and podcasts. This is derived from the SyncList prototype, but strips the app, database, and UI so PulseDeck can consume plain JSON from GitHub.

It runs without credentials or developer APIs, using public playlist pages and feeds only.

## Files

- `sources/playlists.json` is the curated Spotify playlist registry with normalized `interests` and ISO region tags.
- `sources/youtube-playlists.json` is the independently curated YouTube playlist registry.
- `sources/podcasts.json` contains verified publisher RSS feeds with genre, topic, region, and language tags.
- `sources/podcast-genres.json` contains Apple's 19 top-level podcast genres for public chart discovery.
- `scripts/build-feed.mjs` fetches provider metadata/tracks and writes JSON.
- `data/index.json` is the lightweight card list for PulseDeck.
- `data/playlists/{slug}.json` is the full playlist data.
- `data/youtube/index.json` is the lightweight YouTube card list.
- `data/youtube/playlists/{slug}.json` contains public YouTube video metadata and official links only.
- `data/podcasts/index.json` lists playable curated shows and one small chart file per podcast genre.
- `data/podcasts/shows/{slug}.json` contains up to 20 recent publisher-hosted episodes.
- `data/podcasts/genres/{genre}.json` contains the current public Apple chart for that genre.
- `data/apple-regional/index.json` lists the supported Apple Music regional playlist charts.
- `data/apple-editorial/recent-releases.json` lists Apple's Recent Releases albums and EPs in source order, with full track details under `data/apple-editorial/recent-releases/`.
- `data/apple-regional/{country}.json` contains lightweight Apple Music playlist cards for one country.
- `data/apple-country-charts/index.json` lists the selected Apple Music Top 100 country charts and their availability.
- `data/apple-country-charts/{country}.json` contains up to 100 ranked songs, or an explicit unavailable state.
- `data/changes/latest.json` shows the latest added/removed tracks.
- `data/announcements.json` is the app inbox written by the trusted publishing bot.

## Discovery contract

Spotify source entries keep the legacy `category` field and add two arrays:

```json
{
  "slug": "ethiopian-orthodox-mezmur",
  "title": "Ethiopian Orthodox Tewahedo Mezmur",
  "category": "faith/ethiopian-orthodox",
  "playlistId": "0WQTVd6Tx3YDHwpszCNHVp",
  "interests": ["ethiopian-orthodox", "mezmur", "devotional"],
  "regions": ["ET"]
}
```

`interests` uses stable lowercase kebab-case identifiers. `regions` contains ISO 3166-1 alpha-2 country codes or `GLOBAL`. Region describes editorial relevance, not playback licensing.

YouTube and Apple regional cards use the same `interests` and `regions` fields. Provider records remain separate, and detail files are loaded only when needed.

Country-chart details expose `status` (`fresh`, `curated`, `stale`, or `unavailable`), `available`, `stale`, and `checkedAt`. A provider failure retains a previously valid chart as stale; when Apple has no storefront chart, the country file is rebuilt from matching region-tagged local playlists and clearly marked `pulsedeck-curated`. A country with neither source writes an explicit unavailable record so validation can block an incomplete publish with a precise error.

YouTube details include `contentComplete` and `contentTruncated`. Public HTML supplies a useful initial metadata batch plus the full official playlist link. A richer previous result is never replaced by a shorter public-page result; retained data is marked stale until a full public refresh succeeds.

Podcast `genres` use the official top-level Apple taxonomy, while `topics`, `regions`, and `languages` remain independent filters. Curated publisher RSS supplies playable enclosure URLs; Apple charts supply broader discovery cards. Audio is never copied into this repository.

## Announcement contract

Announcement writers increment `revision`, update `generatedAt`, prepend a uniquely identified message, and keep at most 50 messages.

```json
{
  "schemaVersion": 1,
  "revision": 1,
  "generatedAt": "2026-07-28T12:00:00.000Z",
  "messages": [{
    "id": "announcement-example",
    "title": "PulseDeck update",
    "body": "Your message",
    "type": "info",
    "publishedAt": "2026-07-28T12:00:00.000Z",
    "expiresAt": null,
    "action": null
  }]
}
```

`type` is `info`, `update`, or `warning`. `action` is `null` or an object containing a short `label` and HTTPS `url`.

## GitHub setup

No secrets or API keys are required.

The workflow runs daily at `06:17 UTC` and can also be run manually from GitHub Actions.

## Local commands

```bash
npm ci
npm run validate
npm run generate
npm run check:data
```

`npm run generate` works without credentials. The feed stores metadata, artwork references, and official provider URLs; it never downloads or redistributes audio.
