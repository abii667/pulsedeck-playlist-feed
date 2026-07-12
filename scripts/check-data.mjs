import { readFile } from "node:fs/promises";

const index = JSON.parse(await readFile("data/index.json", "utf8"));
if (index.playlistCount !== 20) throw new Error("Expected 20 playlists.");
for (const playlist of index.playlists) {
  if (!playlist.coverImage) throw new Error(`${playlist.slug} is missing coverImage.`);
  if (!playlist.embedUrl) throw new Error(`${playlist.slug} is missing embedUrl.`);
  if (!playlist.trackCount || playlist.trackCount < 1) {
    throw new Error(`${playlist.slug} is missing public tracks.`);
  }
}
console.log("Feed JSON has covers, embeds, and tracks for all playlists.");
