import { readFile } from "node:fs/promises";

const EXPECTED_APPLE_REGION_COUNT = 156;
const isIsoDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
  !Number.isNaN(Date.parse(value));

const sources = JSON.parse(await readFile("sources/playlists.json", "utf8"));
const sourcesBySlug = new Map(sources.map((source) => [source.slug, source]));
const youtubeSources = JSON.parse(await readFile("sources/youtube-playlists.json", "utf8"));
const youtubeSourcesBySlug = new Map(youtubeSources.map((source) => [source.slug, source]));
const expectedAndroidMusicInterests = [
  "pop", "hip-hop", "rap", "rnb", "rock", "blues", "folk", "afrobeats", "amapiano",
  "ethiopian", "ethio-jazz", "ethiopian-orthodox", "gospel", "catholic", "jazz",
  "soul", "reggae", "electronic", "dance", "ambient", "classical", "throwbacks",
  "country", "latin", "indie", "alternative", "arabic", "indian", "k-pop", "j-pop",
  "lofi", "workout"
];
const configuredMusicInterests = new Set(
  [...sources, ...youtubeSources].flatMap((source) => source.interests)
);
const missingAndroidMusicInterests = expectedAndroidMusicInterests.filter(
  (interest) => !configuredMusicInterests.has(interest)
);
if (missingAndroidMusicInterests.length) {
  throw new Error(`Missing Android music interests: ${missingAndroidMusicInterests.join(", ")}.`);
}
const podcastSources = JSON.parse(await readFile("sources/podcasts.json", "utf8"));
const podcastSourcesBySlug = new Map(podcastSources.map((source) => [source.slug, source]));
const podcastGenres = JSON.parse(await readFile("sources/podcast-genres.json", "utf8"));
const podcastGenresBySlug = new Map(podcastGenres.map((source) => [source.slug, source]));
const index = JSON.parse(await readFile("data/index.json", "utf8"));
if (index.playlistCount !== sources.length || index.playlists.length !== sources.length) {
  throw new Error(`Expected ${sources.length} Spotify playlists.`);
}
if (!Array.isArray(index.interests) || !index.interests.length) throw new Error("Expected feed interests.");
if (!Array.isArray(index.regions) || !index.regions.length) throw new Error("Expected feed regions.");
if (!Array.isArray(index.sections) || index.sections.length < 3) throw new Error("Expected feed sections.");
if (!index.sections.some((section) => section.source === "data/youtube/index.json")) {
  throw new Error("Expected a YouTube feed section.");
}
if (!index.sections.some((section) => section.source === "data/podcasts/index.json")) {
  throw new Error("Expected a podcast feed section.");
}
for (const playlist of index.playlists) {
  const source = sourcesBySlug.get(playlist.slug);
  if (!source) throw new Error(`${playlist.slug} is not a configured source.`);
  if (!playlist.coverImage) throw new Error(`${playlist.slug} is missing coverImage.`);
  if (!playlist.embedUrl) throw new Error(`${playlist.slug} is missing embedUrl.`);
  if (JSON.stringify(playlist.interests) !== JSON.stringify(source.interests)) {
    throw new Error(`${playlist.slug} has mismatched interests.`);
  }
  if (JSON.stringify(playlist.regions) !== JSON.stringify(source.regions)) {
    throw new Error(`${playlist.slug} has mismatched regions.`);
  }
  if (!playlist.trackCount || playlist.trackCount < 1) {
    throw new Error(`${playlist.slug} is missing public tracks.`);
  }
  const detail = JSON.parse(await readFile(`data/playlists/${playlist.slug}.json`, "utf8"));
  if (detail.spotifyId !== source.playlistId) throw new Error(`${playlist.slug} has a mismatched Spotify id.`);
  if (detail.trackCount !== detail.tracks?.length) throw new Error(`${playlist.slug} has a mismatched detail track count.`);
  if (JSON.stringify(detail.interests) !== JSON.stringify(source.interests)) {
    throw new Error(`${playlist.slug} detail has mismatched interests.`);
  }
  if (JSON.stringify(detail.regions) !== JSON.stringify(source.regions)) {
    throw new Error(`${playlist.slug} detail has mismatched regions.`);
  }
}

const youtubeIndex = JSON.parse(await readFile("data/youtube/index.json", "utf8"));
if (
  youtubeIndex.provider !== "youtube" ||
  youtubeIndex.playlistCount !== youtubeSources.length ||
  youtubeIndex.playlists?.length !== youtubeSources.length
) {
  throw new Error(`Expected ${youtubeSources.length} YouTube playlists.`);
}
for (const playlist of youtubeIndex.playlists) {
  const source = youtubeSourcesBySlug.get(playlist.slug);
  if (!source) throw new Error(`${playlist.slug} is not a configured YouTube source.`);
  if (
    playlist.provider !== "youtube" ||
    playlist.youtubePlaylistId !== source.playlistId ||
    !playlist.coverImage ||
    !playlist.youtubeUrl ||
    !playlist.youtubeMusicUrl ||
    !playlist.embedUrl ||
    typeof playlist.contentComplete !== "boolean" ||
    playlist.contentTruncated !== !playlist.contentComplete ||
    playlist.youtubeItemTotal < playlist.trackCount ||
    playlist.trackCount < source.minTracks
  ) {
    throw new Error(`${playlist.slug} has incomplete YouTube metadata.`);
  }
  if (JSON.stringify(playlist.interests) !== JSON.stringify(source.interests)) {
    throw new Error(`${playlist.slug} has mismatched YouTube interests.`);
  }
  if (JSON.stringify(playlist.regions) !== JSON.stringify(source.regions)) {
    throw new Error(`${playlist.slug} has mismatched YouTube regions.`);
  }

  const detail = JSON.parse(await readFile(`data/youtube/playlists/${playlist.slug}.json`, "utf8"));
  if (
    detail.provider !== "youtube" ||
    detail.youtubePlaylistId !== source.playlistId ||
    detail.trackCount !== detail.tracks?.length ||
    typeof detail.contentComplete !== "boolean" ||
    detail.contentTruncated !== !detail.contentComplete ||
    detail.youtubeItemTotal < detail.trackCount ||
    detail.trackCount < source.minTracks
  ) {
    throw new Error(`${playlist.slug} has incomplete YouTube detail.`);
  }
  if (
    JSON.stringify(detail.interests) !== JSON.stringify(source.interests) ||
    JSON.stringify(detail.regions) !== JSON.stringify(source.regions)
  ) {
    throw new Error(`${playlist.slug} detail has mismatched YouTube discovery tags.`);
  }
  for (const field of [
    "provider",
    "title",
    "coverImage",
    "youtubePlaylistId",
    "youtubeUrl",
    "youtubeMusicUrl",
    "embedUrl",
    "snapshotId",
    "fetchMode",
    "contentMode",
    "contentComplete",
    "contentTruncated",
    "tracksAvailable",
    "trackCount",
    "youtubeItemTotal",
    "updatedAt",
    "stale"
  ]) {
    if (playlist[field] !== detail[field]) {
      throw new Error(`${playlist.slug} has mismatched YouTube ${field}.`);
    }
  }
  const videoIds = new Set();
  for (const [trackIndex, track] of detail.tracks.entries()) {
    if (
      track.position !== trackIndex + 1 ||
      !track.youtubeVideoId ||
      !track.title ||
      !track.coverImage ||
      !track.youtubeUrl ||
      !track.youtubeMusicUrl
    ) {
      throw new Error(`${playlist.slug} has an incomplete YouTube track.`);
    }
    if (videoIds.has(track.youtubeVideoId)) {
      throw new Error(`${playlist.slug} has a duplicate YouTube video.`);
    }
    videoIds.add(track.youtubeVideoId);
  }
}

const podcastIndex = JSON.parse(await readFile("data/podcasts/index.json", "utf8"));
if (
  podcastIndex.showCount !== podcastSources.length ||
  podcastIndex.shows?.length !== podcastSources.length ||
  podcastIndex.genreCount !== podcastGenres.length ||
  podcastIndex.genres?.length !== podcastGenres.length ||
  !podcastIndex.chartShowPlacementCount
) {
  throw new Error("Podcast index counts do not match configured sources.");
}
if (
  JSON.stringify(podcastIndex.providers) !== JSON.stringify(["podcast-rss", "apple-podcasts"]) ||
  !/^[A-Z]{2}$/.test(podcastIndex.market)
) {
  throw new Error("Podcast index has invalid provider or market metadata.");
}

for (const show of podcastIndex.shows) {
  const source = podcastSourcesBySlug.get(show.slug);
  if (!source) throw new Error(`${show.slug} is not a configured podcast source.`);
  if (
    show.provider !== "podcast-rss" ||
    show.feedUrl !== source.feedUrl ||
    !show.title ||
    !show.publisher ||
    !isHttpsUrl(show.coverImage) ||
    !show.episodeCount ||
    show.episodeCount < source.minEpisodes ||
    show.detailSource !== `data/podcasts/shows/${source.slug}.json`
  ) {
    throw new Error(`${show.slug} has incomplete podcast metadata.`);
  }
  for (const field of ["genres", "topics", "regions", "languages"]) {
    if (JSON.stringify(show[field]) !== JSON.stringify(source[field])) {
      throw new Error(`${show.slug} has mismatched podcast ${field}.`);
    }
  }

  const detail = JSON.parse(await readFile(show.detailSource, "utf8"));
  if (
    detail.provider !== "podcast-rss" ||
    detail.feedUrl !== source.feedUrl ||
    detail.episodeCount !== detail.episodes?.length ||
    detail.episodeCount < source.minEpisodes ||
    detail.episodeCount > 20
  ) {
    throw new Error(`${show.slug} has incomplete podcast detail.`);
  }
  for (const field of ["genres", "topics", "regions", "languages"]) {
    if (JSON.stringify(detail[field]) !== JSON.stringify(source[field])) {
      throw new Error(`${show.slug} detail has mismatched podcast ${field}.`);
    }
  }
  for (const field of [
    "provider",
    "title",
    "publisher",
    "description",
    "coverImage",
    "feedUrl",
    "websiteUrl",
    "snapshotId",
    "latestEpisodeAt",
    "episodeCount",
    "updatedAt",
    "stale"
  ]) {
    if (show[field] !== detail[field]) throw new Error(`${show.slug} has mismatched podcast ${field}.`);
  }

  const episodeIds = new Set();
  const audioUrls = new Set();
  for (const [episodeIndex, episode] of detail.episodes.entries()) {
    if (
      episode.position !== episodeIndex + 1 ||
      !episode.id ||
      !episode.title ||
      !isIsoDate(episode.publishedAt) ||
      !isHttpsUrl(episode.audioUrl)
    ) {
      throw new Error(`${show.slug} has an incomplete podcast episode.`);
    }
    if (episodeIds.has(episode.id) || audioUrls.has(episode.audioUrl)) {
      throw new Error(`${show.slug} has a duplicate podcast episode.`);
    }
    episodeIds.add(episode.id);
    audioUrls.add(episode.audioUrl);
  }
}

let podcastChartShowCount = 0;
for (const genre of podcastIndex.genres) {
  const source = podcastGenresBySlug.get(genre.slug);
  if (
    !source ||
    genre.title !== source.title ||
    genre.appleGenreId !== source.appleGenreId ||
    genre.source !== `data/podcasts/genres/${source.slug}.json` ||
    genre.chartShowCount < 10 ||
    !Number.isInteger(genre.curatedShowCount)
  ) {
    throw new Error(`${genre.slug} has incomplete podcast genre metadata.`);
  }
  const detail = JSON.parse(await readFile(genre.source, "utf8"));
  if (
    detail.provider !== "apple-podcasts" ||
    detail.genre !== source.slug ||
    detail.genreName !== source.title ||
    detail.appleGenreId !== source.appleGenreId ||
    detail.market !== podcastIndex.market ||
    detail.showCount !== detail.shows?.length ||
    detail.showCount !== genre.chartShowCount
  ) {
    throw new Error(`${genre.slug} has incomplete podcast chart detail.`);
  }
  const showIds = new Set();
  for (const [showIndex, show] of detail.shows.entries()) {
    if (
      show.position !== showIndex + 1 ||
      show.provider !== "apple-podcasts" ||
      !show.appleId ||
      !show.title ||
      !show.publisher ||
      !isHttpsUrl(show.coverImage) ||
      !isHttpsUrl(show.appleUrl) ||
      JSON.stringify(show.genres) !== JSON.stringify([source.slug]) ||
      JSON.stringify(show.regions) !== JSON.stringify([podcastIndex.market])
    ) {
      throw new Error(`${genre.slug} has an incomplete Apple podcast card.`);
    }
    if (showIds.has(show.appleId)) throw new Error(`${genre.slug} has a duplicate Apple podcast.`);
    showIds.add(show.appleId);
  }
  podcastChartShowCount += detail.showCount;
}
if (podcastChartShowCount !== podcastIndex.chartShowPlacementCount) {
  throw new Error("Podcast chart placement count does not match its index.");
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
const editorialRooms = {
  "premium-albums": "6794200618",
  "premium-playlists": "6794200629",
};
for (const shelf of editorialIndex.shelves) {
  if (!shelf.itemCount || shelf.itemCount < 10) throw new Error(`${shelf.slug} has too few Apple editorial items.`);
  const detail = JSON.parse(await readFile(`data/apple-editorial/${shelf.slug}.json`, "utf8"));
  if (detail.roomId !== editorialRooms[shelf.slug]) throw new Error(`${shelf.slug} uses the wrong Apple room.`);
  if (!Array.isArray(detail.items) || detail.items.length < 10) throw new Error(`${shelf.slug} detail has too few items.`);
  for (const [index, item] of detail.items.entries()) {
    if (item.position !== index + 1) throw new Error(`${shelf.slug} is not in Apple source order.`);
    if (!item.title || !item.coverImage || !item.appleUrl || !item.detailSource) throw new Error(`${shelf.slug} has an incomplete item.`);
    const itemDetail = JSON.parse(await readFile(item.detailSource, "utf8"));
    if (!Array.isArray(itemDetail.tracks) || itemDetail.tracks.length < 1) throw new Error(`${item.title} has no Apple tracklist.`);
    if ((item.trackCount || 0) !== itemDetail.tracks.length) throw new Error(`${item.title} has a mismatched track count.`);
    if (shelf.slug === "premium-playlists" && item.coverImage !== itemDetail.tracks[0].album?.coverImage) {
      throw new Error(`${item.title} does not use its first track artwork.`);
    }
  }
}

const regionalIndex = JSON.parse(await readFile("data/apple-regional/index.json", "utf8"));
if (regionalIndex.regionCount !== EXPECTED_APPLE_REGION_COUNT) {
  throw new Error(`Expected ${EXPECTED_APPLE_REGION_COUNT} Apple regions.`);
}
if (!regionalIndex.playlistCount || !Array.isArray(regionalIndex.regions)) {
  throw new Error("Apple regional index is empty.");
}
if (regionalIndex.regionCount !== regionalIndex.regions.length) {
  throw new Error("Apple regional region count does not match its index.");
}
let regionalPlaylistCount = 0;
for (const region of regionalIndex.regions) {
  if (!/^[A-Z]{2}$/.test(region.code) || !region.name || !region.source) {
    throw new Error("Apple regional index has an invalid region.");
  }
  const detail = JSON.parse(await readFile(region.source, "utf8"));
  if (detail.region !== region.code || detail.provider !== "apple-music") {
    throw new Error(`${region.code} has mismatched Apple regional metadata.`);
  }
  if (!Array.isArray(detail.playlists) || detail.playlists.length < 10) {
    throw new Error(`${region.code} has too few regional playlists.`);
  }
  if (region.playlistCount !== detail.playlists.length || detail.playlistCount !== detail.playlists.length) {
    throw new Error(`${region.code} has a mismatched regional playlist count.`);
  }
  for (const [index, playlist] of detail.playlists.entries()) {
    if (
      playlist.position !== index + 1 ||
      playlist.provider !== "apple-music" ||
      !playlist.appleId ||
      !playlist.title ||
      !playlist.coverImage ||
      !playlist.appleUrl ||
      !Array.isArray(playlist.interests) ||
      !playlist.interests.length ||
      JSON.stringify(playlist.regions) !== JSON.stringify([region.code])
    ) {
      throw new Error(`${region.code} has an incomplete regional playlist.`);
    }
  }
  regionalPlaylistCount += detail.playlists.length;
}
if (regionalPlaylistCount !== regionalIndex.playlistCount) {
  throw new Error("Apple regional playlist count does not match its index.");
}

const buildStatus = JSON.parse(await readFile("data/status.json", "utf8"));
const statusItems = [
  ...(buildStatus.playlists || []),
  ...(buildStatus.youtube || []),
  ...(buildStatus.podcasts || []),
  ...(buildStatus.appleHero || []),
  ...(buildStatus.appleEditorial || []),
  buildStatus.trendingAlbums,
  ...(buildStatus.appleRegional || [])
].filter(Boolean);
if (
  buildStatus.playlists?.length !== sources.length ||
  buildStatus.youtube?.length !== youtubeSources.length ||
  buildStatus.podcasts?.length !== podcastSources.length + podcastGenres.length ||
  buildStatus.appleHero?.length !== heroIndex.playlistCount ||
  buildStatus.appleEditorial?.length !== editorialIndex.shelfCount ||
  buildStatus.appleRegional?.length !== regionalIndex.regionCount ||
  !buildStatus.trendingAlbums
) {
  throw new Error("Feed status is missing a generated feed.");
}
if (buildStatus.ok !== statusItems.every((item) => item.ok)) {
  throw new Error("Feed status does not match its generated feeds.");
}

const announcements = JSON.parse(await readFile("data/announcements.json", "utf8"));
if (announcements.schemaVersion !== 1) throw new Error("Announcements use an unsupported schema version.");
if (!Number.isInteger(announcements.revision) || announcements.revision < 0) {
  throw new Error("Announcements revision must be a non-negative integer.");
}
if (!isIsoDate(announcements.generatedAt)) throw new Error("Announcements generatedAt must be UTC ISO-8601.");
if (!Array.isArray(announcements.messages) || announcements.messages.length > 50) {
  throw new Error("Announcements messages must be an array of at most 50 items.");
}

const announcementIds = new Set();
for (const message of announcements.messages) {
  if (!message || typeof message.id !== "string" || !message.id.trim() || message.id.length > 128) {
    throw new Error("Announcement id must be a non-empty string of at most 128 characters.");
  }
  if (announcementIds.has(message.id)) throw new Error(`Duplicate announcement id: ${message.id}`);
  announcementIds.add(message.id);
  if (typeof message.title !== "string" || !message.title.trim() || message.title.length > 120) {
    throw new Error(`${message.id} has an invalid title.`);
  }
  if (typeof message.body !== "string" || !message.body.trim() || message.body.length > 2000) {
    throw new Error(`${message.id} has an invalid body.`);
  }
  if (!["info", "update", "warning"].includes(message.type)) {
    throw new Error(`${message.id} has an invalid type.`);
  }
  if (!isIsoDate(message.publishedAt)) throw new Error(`${message.id} has an invalid publishedAt.`);
  if (
    message.expiresAt !== null &&
    (!isIsoDate(message.expiresAt) || Date.parse(message.expiresAt) <= Date.parse(message.publishedAt))
  ) {
    throw new Error(`${message.id} has an invalid expiresAt.`);
  }
  if (message.action !== null) {
    if (
      typeof message.action !== "object" ||
      typeof message.action.label !== "string" ||
      !message.action.label.trim() ||
      message.action.label.length > 48
    ) {
      throw new Error(`${message.id} has an invalid action label.`);
    }
    try {
      if (new URL(message.action.url).protocol !== "https:") throw new Error();
    } catch {
      throw new Error(`${message.id} action must use an HTTPS URL.`);
    }
  }
}

console.log(
  "Feed JSON has tagged music playlists, playable podcast RSS, genre charts, Apple feeds, and announcements.",
);

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
