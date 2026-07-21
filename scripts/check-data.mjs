import { readFile } from "node:fs/promises";

const index = JSON.parse(await readFile("data/index.json", "utf8"));
if (index.playlistCount !== 20) throw new Error("Expected 20 playlists.");
if (!Array.isArray(index.sections) || index.sections.length < 2) throw new Error("Expected feed sections.");
for (const playlist of index.playlists) {
  if (!playlist.coverImage) throw new Error(`${playlist.slug} is missing coverImage.`);
  if (!playlist.embedUrl) throw new Error(`${playlist.slug} is missing embedUrl.`);
  if (!playlist.trackCount || playlist.trackCount < 1) {
    throw new Error(`${playlist.slug} is missing public tracks.`);
  }
}

const heroIndex = JSON.parse(await readFile("data/apple-heroes/index.json", "utf8"));
if (heroIndex.playlistCount !== 3) throw new Error("Expected 3 Apple hero playlists.");
for (const playlist of heroIndex.playlists) {
  if (!playlist.trackCount || playlist.trackCount < 25) throw new Error(`${playlist.slug} has too few Apple hero tracks.`);
  const detail = JSON.parse(await readFile(`data/apple-heroes/${playlist.slug}.json`, "utf8"));
  if (!Array.isArray(detail.tracks) || detail.tracks.length < 25) throw new Error(`${playlist.slug} detail has too few tracks.`);
}

const albums = JSON.parse(await readFile("data/trending-albums.json", "utf8"));
if ((albums.feed?.results || []).length < 10) throw new Error("Trending albums feed has too few albums.");

console.log("Feed JSON has playlists, Apple hero tracks, sections, and trending albums.");
