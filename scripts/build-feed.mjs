import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_FILE = path.join(ROOT, "sources", "playlists.json");
const DATA_DIR = path.join(ROOT, "data");
const PLAYLIST_DIR = path.join(DATA_DIR, "playlists");
const CHANGES_DIR = path.join(DATA_DIR, "changes");
const MARKET = process.env.SPOTIFY_MARKET || "US";
const PLAYLIST_ID_RE = /^[A-Za-z0-9]{22}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const args = new Set(process.argv.slice(2));
const sources = JSON.parse(await readFile(SOURCE_FILE, "utf8"));
validateSources(sources);

if (args.has("--validate")) {
  console.log(`Validated ${sources.length} playlist sources.`);
  process.exit(0);
}

const generatedAt = new Date().toISOString();
const token = await getSpotifyToken();
const status = [];
const playlists = [];
const changes = [];
let failedWithoutFallback = false;

await mkdir(PLAYLIST_DIR, { recursive: true });
await mkdir(CHANGES_DIR, { recursive: true });

for (const source of sources) {
  const file = path.join(PLAYLIST_DIR, `${source.slug}.json`);
  const previous = await readJson(file);

  try {
    const playlist = await buildPlaylist(source, previous, token, generatedAt);
    playlists.push(playlist);

    if (!previous || playlist.snapshotId !== previous.snapshotId) {
      changes.push(diffPlaylist(previous, playlist));
    }

    await writeJson(file, playlist);
    status.push({
      slug: source.slug,
      ok: true,
      stale: false,
      snapshotId: playlist.snapshotId,
      trackCount: playlist.trackCount
    });
  } catch (error) {
    if (previous) {
      playlists.push({ ...previous, stale: true });
      status.push({
        slug: source.slug,
        ok: false,
        stale: true,
        error: error.message
      });
      continue;
    }

    failedWithoutFallback = true;
    status.push({
      slug: source.slug,
      ok: false,
      stale: false,
      error: error.message
    });
  }
}

await writeJson(path.join(DATA_DIR, "index.json"), {
  schemaVersion: 1,
  generatedAt,
  market: MARKET,
  playlistCount: playlists.length,
  playlists: playlists.map(toIndexCard)
});

await writeJson(path.join(CHANGES_DIR, "latest.json"), {
  schemaVersion: 1,
  generatedAt,
  changedCount: changes.length,
  changes
});

await writeJson(path.join(DATA_DIR, "status.json"), {
  schemaVersion: 1,
  generatedAt,
  ok: !failedWithoutFallback && status.every((item) => item.ok),
  playlists: status
});

if (failedWithoutFallback) {
  throw new Error("One or more playlists failed and no previous JSON exists.");
}

console.log(`Wrote ${playlists.length} playlists to data/.`);

function validateSources(items) {
  assert(Array.isArray(items), "sources/playlists.json must be an array");
  assert(items.length === 20, "expected exactly 20 playlist sources");

  const slugs = new Set();
  const ids = new Set();
  for (const item of items) {
    assert(SLUG_RE.test(item.slug || ""), `bad slug: ${item.slug}`);
    assert(!slugs.has(item.slug), `duplicate slug: ${item.slug}`);
    assert(PLAYLIST_ID_RE.test(item.playlistId || ""), `bad playlist id for ${item.slug}`);
    assert(!ids.has(item.playlistId), `duplicate playlist id: ${item.playlistId}`);
    assert(typeof item.title === "string" && item.title.trim(), `missing title for ${item.slug}`);
    assert(typeof item.category === "string" && item.category.trim(), `missing category for ${item.slug}`);
    slugs.add(item.slug);
    ids.add(item.playlistId);
  }
}

async function getSpotifyToken() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.");
  }

  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!res.ok) {
    throw new Error(`Spotify auth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function buildPlaylist(source, previous, token, generatedAt) {
  const metaFields = [
    "id",
    "name",
    "description",
    "external_urls",
    "images",
    "owner(display_name,id,external_urls)",
    "snapshot_id",
    "tracks(total)"
  ].join(",");
  const meta = await spotifyGet(
    `https://api.spotify.com/v1/playlists/${source.playlistId}?market=${MARKET}&fields=${encodeURIComponent(metaFields)}`,
    token
  );

  const snapshotId = meta.snapshot_id || null;
  const reusedTracks = previous && previous.snapshotId === snapshotId;
  const tracks = reusedTracks ? previous.tracks : await fetchTracks(source.playlistId, token);

  return {
    schemaVersion: 1,
    slug: source.slug,
    title: meta.name || source.title,
    category: source.category,
    spotifyId: source.playlistId,
    spotifyUrl: meta.external_urls?.spotify || `https://open.spotify.com/playlist/${source.playlistId}`,
    description: stripHtml(meta.description || ""),
    owner: {
      id: meta.owner?.id || null,
      name: meta.owner?.display_name || null,
      spotifyUrl: meta.owner?.external_urls?.spotify || null
    },
    coverImage: firstImage(meta.images),
    snapshotId,
    market: MARKET,
    trackCount: tracks.length,
    spotifyTrackTotal: meta.tracks?.total ?? tracks.length,
    updatedAt: generatedAt,
    tracks
  };
}

async function fetchTracks(playlistId, token) {
  const fields = [
    "items(added_at,track(type,id,name,duration_ms,explicit,preview_url,uri,external_urls,album(id,name,images,external_urls,release_date),artists(id,name,external_urls)))",
    "next",
    "total"
  ].join(",");
  const tracks = [];
  let offset = 0;

  while (true) {
    const page = await spotifyGet(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=${MARKET}&limit=100&offset=${offset}&fields=${encodeURIComponent(fields)}`,
      token
    );

    for (const item of page.items || []) {
      const track = item.track;
      if (!track || track.type !== "track") continue;
      tracks.push(toTrack(track, item.added_at, tracks.length + 1));
    }

    if (!page.next) return tracks;
    offset += 100;
  }
}

async function spotifyGet(url, token) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000)
    });

    if (res.status === 429 && attempt === 0) {
      const seconds = Number(res.headers.get("retry-after") || "2");
      await sleep(seconds * 1000);
      continue;
    }

    if (!res.ok) {
      throw new Error(`Spotify fetch failed: ${res.status} ${await res.text()}`);
    }

    return res.json();
  }
}

function toTrack(track, addedAt, position) {
  const artists = (track.artists || []).map((artist) => ({
    id: artist.id || null,
    name: artist.name,
    spotifyUrl: artist.external_urls?.spotify || null
  }));

  return {
    position,
    addedAt,
    spotifyId: track.id,
    title: track.name,
    artistNames: artists.map((artist) => artist.name),
    artists,
    album: {
      id: track.album?.id || null,
      name: track.album?.name || null,
      releaseDate: track.album?.release_date || null,
      coverImage: firstImage(track.album?.images),
      spotifyUrl: track.album?.external_urls?.spotify || null
    },
    durationMs: track.duration_ms ?? null,
    explicit: Boolean(track.explicit),
    previewUrl: track.preview_url || null,
    uri: track.uri || null,
    spotifyUrl: track.external_urls?.spotify || null
  };
}

function toIndexCard(playlist) {
  return {
    slug: playlist.slug,
    title: playlist.title,
    category: playlist.category,
    coverImage: playlist.coverImage,
    spotifyUrl: playlist.spotifyUrl,
    snapshotId: playlist.snapshotId,
    trackCount: playlist.trackCount,
    updatedAt: playlist.updatedAt,
    stale: Boolean(playlist.stale)
  };
}

function diffPlaylist(previous, playlist) {
  const before = new Map((previous?.tracks || []).map((track) => [track.spotifyId, track]));
  const after = new Map(playlist.tracks.map((track) => [track.spotifyId, track]));
  const addedTracks = playlist.tracks.filter((track) => !before.has(track.spotifyId));
  const removedTracks = (previous?.tracks || []).filter((track) => !after.has(track.spotifyId));

  return {
    slug: playlist.slug,
    title: playlist.title,
    previousSnapshotId: previous?.snapshotId || null,
    snapshotId: playlist.snapshotId,
    added: addedTracks.length,
    removed: removedTracks.length,
    addedTracks: addedTracks.slice(0, 25).map(toChangeTrack),
    removedTracks: removedTracks.slice(0, 25).map(toChangeTrack)
  };
}

function toChangeTrack(track) {
  return {
    spotifyId: track.spotifyId,
    title: track.title,
    artistNames: track.artistNames
  };
}

async function readJson(file) {
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, "utf8"));
}

async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

function firstImage(images) {
  return Array.isArray(images) && images[0]?.url ? images[0].url : null;
}

function stripHtml(value) {
  return String(value).replace(/<[^>]*>/g, "").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
