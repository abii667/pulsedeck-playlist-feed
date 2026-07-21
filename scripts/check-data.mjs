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

const editorialIndex = JSON.parse(await readFile("data/apple-editorial/index.json", "utf8"));
if (editorialIndex.shelfCount !== 2) throw new Error("Expected 2 Apple editorial shelves.");
for (const shelf of editorialIndex.shelves) {
  if (!shelf.itemCount || shelf.itemCount < 10) throw new Error(`${shelf.slug} has too few Apple editorial items.`);
  const detail = JSON.parse(await readFile(`data/apple-editorial/${shelf.slug}.json`, "utf8"));
  if (!Array.isArray(detail.items) || detail.items.length < 10) throw new Error(`${shelf.slug} detail has too few items.`);
  for (const item of detail.items) {
    if (!item.title || !item.coverImage || !item.appleUrl || !item.detailSource) throw new Error(`${shelf.slug} has an incomplete item.`);
    const itemDetail = JSON.parse(await readFile(item.detailSource, "utf8"));
    if (!Array.isArray(itemDetail.tracks) || itemDetail.tracks.length < 1) throw new Error(`${item.title} has no Apple tracklist.`);
    if ((item.trackCount || 0) !== itemDetail.tracks.length) throw new Error(`${item.title} has a mismatched track count.`);
  }
}

console.log("Feed JSON has playlists, Apple hero tracks, sections, trending albums, and Apple editorial tracklists.");
