import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

const ROOT = process.cwd();
const SOURCE_FILE = path.join(ROOT, "sources", "playlists.json");
const YOUTUBE_SOURCE_FILE = path.join(ROOT, "sources", "youtube-playlists.json");
const PODCAST_SOURCE_FILE = path.join(ROOT, "sources", "podcasts.json");
const PODCAST_GENRE_SOURCE_FILE = path.join(ROOT, "sources", "podcast-genres.json");
const DATA_DIR = path.join(ROOT, "data");
const PLAYLIST_DIR = path.join(DATA_DIR, "playlists");
const YOUTUBE_DIR = path.join(DATA_DIR, "youtube");
const YOUTUBE_PLAYLIST_DIR = path.join(YOUTUBE_DIR, "playlists");
const PODCAST_DIR = path.join(DATA_DIR, "podcasts");
const PODCAST_GENRE_DIR = path.join(PODCAST_DIR, "genres");
const PODCAST_SHOW_DIR = path.join(PODCAST_DIR, "shows");
const CHANGES_DIR = path.join(DATA_DIR, "changes");
const APPLE_HERO_DIR = path.join(DATA_DIR, "apple-heroes");
const APPLE_EDITORIAL_DIR = path.join(DATA_DIR, "apple-editorial");
const APPLE_REGIONAL_DIR = path.join(DATA_DIR, "apple-regional");
const APPLE_COUNTRY_CHART_DIR = path.join(DATA_DIR, "apple-country-charts");
const MARKET = process.env.SPOTIFY_MARKET || "US";
const PODCAST_MARKET = (process.env.PODCAST_MARKET || "US").toUpperCase();
const PODCAST_CHART_LIMIT = 50;
const PODCAST_EPISODE_LIMIT = 20;
const TRENDING_ALBUMS_URL = "https://rss.marketingtools.apple.com/api/v2/us/music/most-played/20/albums.json";
const APPLE_REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });
const APPLE_REGIONAL_MARKETS = [
  "US", "GB", "CA", "AU", "NG", "ZA", "GH", "KE", "UG", "TZ", "IN", "BR", "MX", "DE", "FR", "ES", "IT",
  "JP", "KR", "AE", "SA", "EG", "TR",
  "AO", "BJ", "BW", "CM", "CV", "TD", "CG", "CD", "CI", "SZ", "GA", "GM", "GW", "LR", "MG", "MW", "ML",
  "MR", "MU", "MA", "MZ", "NA", "NE", "RW", "SN", "SC", "SL", "TN", "ZM", "ZW", "DZ", "LY",
  "AR", "BO", "CL", "CO", "CR", "DO", "EC", "GT", "HN", "NI", "PA", "PE", "PY", "SV", "UY", "VE", "JM",
  "TT", "BB", "BS", "BZ", "BM", "KY", "DM", "GD", "GY", "KN", "LC", "VC", "SR",
  "BH", "IL", "JO", "KW", "LB", "OM", "QA", "IQ", "YE",
  "LK", "NP", "BT", "MV", "ID", "MY", "PH", "SG", "TH", "VN", "KH", "LA", "MM",
  "AT", "BE", "CH", "CZ", "DK", "FI", "GR", "HU", "IE", "NL", "NO", "PL", "PT", "RO", "SE", "UA", "BG",
  "HR", "CY", "EE", "IS", "LT", "LU", "LV", "MT", "SI", "SK", "RS", "MK", "MD", "ME", "BY", "RU", "BA",
  "KZ", "KG", "TJ", "TM", "UZ", "AM", "AZ", "GE", "MN", "CN", "HK", "TW", "MO",
  "NZ", "FJ"
].map((code) => ({ code, name: APPLE_REGION_NAMES.of(code) }));
const APPLE_COUNTRY_CHART_MARKETS = (
  "US GB KR CA DE FR PR BR AU SE MX IN CO ES NG JP NO NL AR JM ZA IT DO IE NZ BE DK PH TH ID TR CL RO FI CN PT PL GH MA EG UA CH PK AT CD DZ KE TZ PE VE ET"
).split(" ").map((code) => ({ code, name: APPLE_REGION_NAMES.of(code) }));
const APPLE_INTEREST_RULES = [
  ["ethiopian-orthodox", /\bethiopian orthodox\b|\btewahedo\b|\bkidase\b/],
  ["gospel", /\bgospel\b|\bworship\b|\bchristian\b/],
  ["catholic", /\bcatholic\b/],
  ["devotional", /\bhymn|\bchant|\bdevotional\b|\bworship\b/],
  ["afrobeats", /\bafrobeats?\b|\bnaija\b/],
  ["amapiano", /\bamapiano\b/],
  ["hip-hop", /\bhip[\s-]?hop\b|\brap\b|\bdrill\b|\btrap\b/],
  ["rnb", /\br\s*(?:&|and|n)\s*b\b|\brnb\b/],
  ["jazz", /\bjazz\b/],
  ["rock", /\brock\b|\bmetal\b|\bpunk\b/],
  ["pop", /\bpop\b/],
  ["soul", /\bsoul\b/],
  ["reggae", /\breggae\b|\bdancehall\b/],
  ["latin", /\blatin\b|\breggaeton\b/],
  ["electronic", /\belectronic\b|\bedm\b|\bhouse\b|\btechno\b/],
  ["classical", /\bclassical\b|\borchestra\b|\bopera\b/],
  ["country", /\bcountry\b|\bnashville\b/],
  ["indie", /\bindie\b|\balternative\b/],
  ["indian", /\bindian\b|\bbollywood\b|\bpunjabi\b/],
  ["arabic", /\barabic\b|\bkhaleeji\b/],
  ["k-pop", /\bk[\s-]?pop\b/],
  ["j-pop", /\bj[\s-]?pop\b/],
  ["workout", /\bworkout\b|\bfitness\b|\bgym\b/],
  ["chill", /\bchill\b|\bsleep\b|\brelax\b/],
  ["focus", /\bfocus\b|\bstudy\b|\blofi\b/]
];
const APPLE_HERO_SOURCES = [
  {
    slug: "trending-songs",
    title: "Trending Songs",
    subtitle: "Apple Music trending songs",
    category: "apple/trending",
    roomId: "6791844174",
    minTracks: 25
  },
  {
    slug: "recent-releases",
    title: "Recent Releases",
    subtitle: "Apple Music recent releases",
    category: "apple/recent",
    roomId: "6794200618",
    minTracks: 25
  },
  {
    slug: "best-new-songs",
    title: "Best New Songs",
    subtitle: "Apple Music best new songs",
    category: "apple/best-new",
    roomId: "6791844550",
    minTracks: 25
  }
];
const APPLE_EDITORIAL_SOURCES = [
  {
    slug: "recent-releases",
    title: "Recent Releases",
    subtitle: "New albums and EPs from Apple Music",
    category: "apple/recent-releases",
    roomId: "6808489153",
    minItems: 10
  },
  {
    slug: "premium-albums",
    title: "Premium Albums",
    subtitle: "Apple Music editorial albums",
    category: "apple/albums",
    roomId: "6794200618",
    minItems: 10
  },
  {
    slug: "premium-playlists",
    title: "Premium Playlists",
    subtitle: "Apple Music updated playlists",
    category: "apple/playlists",
    roomId: "6794200629",
    minItems: 10
  }
];
const APPLE_EDITORIAL_TRACK_LIMIT = 100;
const PLAYLIST_ID_RE = /^[A-Za-z0-9]{22}$/;
const YOUTUBE_PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{10,80}$/;
const APPLE_PODCAST_GENRE_ID_RE = /^\d{4}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const PODCAST_XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  trimValues: true
});

const args = new Set(process.argv.slice(2));
const sources = JSON.parse(await readFile(SOURCE_FILE, "utf8"));
const youtubeSources = JSON.parse(await readFile(YOUTUBE_SOURCE_FILE, "utf8"));
const podcastSources = JSON.parse(await readFile(PODCAST_SOURCE_FILE, "utf8"));
const podcastGenres = JSON.parse(await readFile(PODCAST_GENRE_SOURCE_FILE, "utf8"));
validateSources(sources);
validateYouTubeSources(youtubeSources);
validatePodcastSources(podcastSources, podcastGenres);
validatePodcastGenres(podcastGenres);
validateInterestInference();
validateAppleRegionalMarkets();
validateAppleCountryChartMarkets();
validateYouTubeParser();
validatePodcastParser();

if (args.has("--validate")) {
  const etPlaylists = (await Promise.all(
    sources.filter((source) => source.regions.includes("ET"))
      .map((source) => readJson(path.join(PLAYLIST_DIR, `${source.slug}.json`)))
  )).filter(Boolean);
  const etChart = buildPulseDeckCuratedCountryTracks("ET", etPlaylists);
  assert(etChart.length === 100, "PulseDeck Ethiopia fallback did not produce a Top 100");
  assert(etChart.every((track) => track.artist && track.coverImage && track.sourceUrl), "Invalid Ethiopia fallback track");
  console.log(
    `Validated ${sources.length} Spotify, ${youtubeSources.length} YouTube, ${podcastSources.length} podcast feeds, ` +
    `${podcastGenres.length} podcast genres, ` +
    `${APPLE_REGIONAL_MARKETS.length} Apple playlist markets, and ` +
    `${APPLE_COUNTRY_CHART_MARKETS.length} Apple country charts.`
  );
  process.exit(0);
}

const generatedAt = new Date().toISOString();
const status = [];
const playlists = [];
const changes = [];
let failedWithoutFallback = false;

await mkdir(PLAYLIST_DIR, { recursive: true });
await mkdir(YOUTUBE_PLAYLIST_DIR, { recursive: true });
await mkdir(PODCAST_GENRE_DIR, { recursive: true });
await mkdir(PODCAST_SHOW_DIR, { recursive: true });
await mkdir(CHANGES_DIR, { recursive: true });
await mkdir(APPLE_HERO_DIR, { recursive: true });
await mkdir(APPLE_EDITORIAL_DIR, { recursive: true });
await mkdir(APPLE_REGIONAL_DIR, { recursive: true });
await mkdir(APPLE_COUNTRY_CHART_DIR, { recursive: true });

for (const source of sources) {
  const file = path.join(PLAYLIST_DIR, `${source.slug}.json`);
  const previous = await readJson(file);

  try {
    const playlist = await buildPublicPlaylist(source, previous, generatedAt);
    validatePlaylistOutput(playlist);
    playlists.push(playlist);

    if (!previous || playlist.snapshotId !== previous.snapshotId) {
      changes.push(diffPlaylist(previous, playlist));
    }

    await writeJson(file, playlist);
    status.push({
      slug: source.slug,
      ok: true,
      stale: false,
      fetchMode: playlist.fetchMode,
      contentMode: playlist.contentMode,
      tracksAvailable: playlist.tracksAvailable,
      snapshotId: playlist.snapshotId,
      trackCount: playlist.trackCount
    });
  } catch (error) {
    if (previous?.spotifyId === source.playlistId) {
      const fallback = {
        ...previous,
        category: source.category,
        interests: source.interests,
        regions: source.regions,
        updatedAt: sameTaxonomy(previous, source) ? previous.updatedAt : generatedAt,
        stale: true
      };
      await writeJson(file, fallback);
      playlists.push(fallback);
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

const youtube = await buildYouTubeFeeds(youtubeSources, generatedAt);
const podcastShows = await buildPodcastFeeds(podcastSources, generatedAt);
const podcastCharts = await buildPodcastGenreFeeds(podcastGenres, generatedAt);
const podcastGenreShowCounts = new Map(
  podcastGenres.map((genre) => [
    genre.slug,
    podcastShows.index.shows.filter((show) => show.genres.includes(genre.slug)).length
  ])
);
const podcastIndex = {
  schemaVersion: 1,
  generatedAt,
  providers: ["podcast-rss", "apple-podcasts"],
  market: PODCAST_MARKET,
  genreCount: podcastCharts.index.genreCount,
  showCount: podcastShows.index.showCount,
  chartShowPlacementCount: podcastCharts.index.showPlacementCount,
  genres: podcastCharts.index.genres.map((genre) => ({
    ...genre,
    curatedShowCount: podcastGenreShowCounts.get(genre.slug) || 0
  })),
  regions: podcastShows.index.regions,
  languages: podcastShows.index.languages,
  topics: podcastShows.index.topics,
  shows: podcastShows.index.shows
};
await writeJson(path.join(PODCAST_DIR, "index.json"), podcastIndex);
const podcasts = {
  index: podcastIndex,
  status: [...podcastShows.status, ...podcastCharts.status],
  failedWithoutFallback: podcastShows.failedWithoutFallback || podcastCharts.failedWithoutFallback
};
const appleHeroIndex = await buildAppleHeroFeeds(generatedAt);
const trendingAlbumsResult = await buildTrendingAlbumsFeed();
const trendingAlbums = trendingAlbumsResult.data;
const appleEditorialIndex = await buildAppleEditorialFeeds(generatedAt);
const appleRegional = await buildAppleRegionalFeeds(generatedAt);
const appleCountryCharts = await buildAppleCountryChartFeeds(generatedAt);
const appleHeroStatus = appleHeroIndex.playlists.map((playlist) => ({
  slug: playlist.slug,
  ok: !playlist.stale,
  stale: playlist.stale,
  trackCount: playlist.trackCount
}));
const appleEditorialStatus = appleEditorialIndex.shelves.map((shelf) => ({
  slug: shelf.slug,
  ok: !shelf.stale,
  stale: shelf.stale,
  itemCount: shelf.itemCount
}));
const availableInterests = [...new Set([
  ...sources.flatMap((source) => source.interests),
  ...youtubeSources.flatMap((source) => source.interests),
  ...appleRegional.index.interests
])].sort();
const availableRegions = [...new Set([
  ...sources.flatMap((source) => source.regions),
  ...youtubeSources.flatMap((source) => source.regions),
  ...appleRegional.index.regions.map((region) => region.code),
  ...appleCountryCharts.index.regions.map((region) => region.code)
])].sort();

await writeJson(path.join(DATA_DIR, "index.json"), {
  schemaVersion: 1,
  generatedAt,
  market: MARKET,
  interests: availableInterests,
  regions: availableRegions,
  playlistCount: playlists.length,
  playlists: playlists.map(toIndexCard),
  sections: [
    {
      slug: "spotify-pulse-playlists",
      title: "Pulse Playlists",
      subtitle: "Curated playlist feed from PulseDeck",
      source: "data/index.json",
      itemCount: playlists.length,
      updatedAt: generatedAt
    },
    {
      slug: "youtube-playlists",
      title: "YouTube Music Playlists",
      subtitle: "Curated public playlists with playable YouTube links",
      source: "data/youtube/index.json",
      itemCount: youtube.index.playlistCount,
      updatedAt: youtube.index.generatedAt
    },
    {
      slug: "podcasts-by-genre",
      title: "Podcasts",
      subtitle: "Playable publisher feeds and public charts organized by genre",
      source: "data/podcasts/index.json",
      itemCount: podcasts.index.showCount + podcasts.index.chartShowPlacementCount,
      updatedAt: podcasts.index.generatedAt
    },
    ...appleEditorialIndex.shelves.map((shelf) => ({
      slug: shelf.slug,
      title: shelf.title,
      subtitle: shelf.subtitle,
      source: `data/apple-editorial/${shelf.slug}.json`,
      itemCount: shelf.itemCount,
      updatedAt: shelf.updatedAt
    })),
    {
      slug: "apple-country-charts",
      title: "Top 100 by Country",
      subtitle: "Apple Music most-played songs across selected countries",
      source: "data/apple-country-charts/index.json",
      itemCount: appleCountryCharts.index.trackCount,
      updatedAt: appleCountryCharts.index.generatedAt
    },
    {
      slug: "apple-regional-playlists",
      title: "Regional Playlists",
      subtitle: "Apple Music playlist charts across supported regions",
      source: "data/apple-regional/index.json",
      itemCount: appleRegional.index.playlistCount,
      updatedAt: appleRegional.index.generatedAt
    },
    {
      slug: "trending-albums",
      title: "Trending Albums",
      subtitle: "Apple Music US top albums mirrored for PulseDeck",
      source: "data/trending-albums.json",
      itemCount: trendingAlbums.feed?.results?.length || 0,
      updatedAt: trendingAlbums.feed?.updated || generatedAt
    }
  ]
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
  ok:
    !failedWithoutFallback &&
    !youtube.failedWithoutFallback &&
    !podcasts.failedWithoutFallback &&
    !appleRegional.failedWithoutFallback &&
    status.every((item) => item.ok) &&
    youtube.status.every((item) => item.ok) &&
    podcasts.status.every((item) => item.ok) &&
    appleHeroStatus.every((item) => item.ok) &&
    appleEditorialStatus.every((item) => item.ok) &&
    trendingAlbumsResult.status.ok &&
    appleRegional.status.every((item) => item.ok) &&
    appleCountryCharts.status.every((item) => item.ok),
  playlists: status,
  youtube: youtube.status,
  podcasts: podcasts.status,
  appleHero: appleHeroStatus,
  appleEditorial: appleEditorialStatus,
  trendingAlbums: trendingAlbumsResult.status,
  appleRegional: appleRegional.status,
  appleCountryCharts: appleCountryCharts.status
});

if (
  failedWithoutFallback ||
  youtube.failedWithoutFallback ||
  podcasts.failedWithoutFallback ||
  appleRegional.failedWithoutFallback
) {
  throw new Error("One or more feed sources failed and no previous JSON exists.");
}

console.log(
  `Wrote ${playlists.length} Spotify playlists, ${youtube.index.playlistCount} YouTube playlists, ` +
  `${podcasts.index.showCount} playable podcast feeds plus ${podcasts.index.chartShowPlacementCount} chart placements ` +
  `across ${podcasts.index.genreCount} genres, and ` +
  `${appleRegional.index.playlistCount} Apple playlist placements plus ` +
  `${appleCountryCharts.index.trackCount} country-chart placements to data/.`
);

async function buildTrendingAlbumsFeed() {
  const previous = await readJson(path.join(DATA_DIR, "trending-albums.json"));
  try {
    const data = await fetchJson(TRENDING_ALBUMS_URL);
    if ((data.feed?.results || []).length < 10) throw new Error("Apple albums feed returned too few albums");
    await writeJson(path.join(DATA_DIR, "trending-albums.json"), data);
    return {
      data,
      status: { ok: true, stale: false, itemCount: data.feed.results.length }
    };
  } catch (error) {
    if (previous) {
      return {
        data: previous,
        status: {
          ok: false,
          stale: true,
          itemCount: previous.feed?.results?.length || 0,
          error: error.message
        }
      };
    }
    throw error;
  }
}

async function buildAppleRegionalFeeds(generatedAt) {
  const regions = [];
  const status = [];
  const interests = new Set();
  let playlistCount = 0;
  let failedWithoutFallback = false;

  for (const market of APPLE_REGIONAL_MARKETS) {
    const file = path.join(APPLE_REGIONAL_DIR, `${market.code.toLowerCase()}.json`);
    const previous = await readJson(file);
    const sourceUrl =
      `https://rss.marketingtools.apple.com/api/v2/${market.code.toLowerCase()}/music/most-played/50/playlists.json`;
    let detail;

    try {
      const feed = await fetchJson(sourceUrl);
      const results = feed.feed?.results || [];
      if (results.length < 10) throw new Error(`${market.code} returned ${results.length} regional playlists`);
      const updatedAt = toIsoDateOrFallback(feed.feed?.updated, generatedAt);
      const playlists = results.map((item, index) => {
        const itemInterests = inferAppleInterests(item.name);
        const coverImage = appleHighResolutionArtworkUrl(item.artworkUrl100);
        assert(
          item.id && item.name && coverImage && item.url,
          `${market.code} returned an incomplete playlist at position ${index + 1}`
        );
        itemInterests.forEach((interest) => interests.add(interest));
        return {
          position: index + 1,
          id: `apple:${item.id}`,
          provider: "apple-music",
          appleId: item.id,
          title: item.name,
          coverImage,
          appleUrl: item.url,
          interests: itemInterests,
          regions: [market.code]
        };
      });
      detail = {
        schemaVersion: 1,
        provider: "apple-music",
        region: market.code,
        regionName: market.name,
        sourceUrl,
        updatedAt,
        stale: false,
        playlistCount: playlists.length,
        playlists
      };
      status.push({ region: market.code, ok: true, stale: false, playlistCount: playlists.length });
    } catch (error) {
      if (!previous?.playlists?.length) {
        failedWithoutFallback = true;
        status.push({
          region: market.code,
          ok: false,
          stale: false,
          playlistCount: 0,
          error: error.message
        });
        continue;
      }
      detail = { ...previous, stale: true };
      detail.playlists.flatMap((item) => item.interests || []).forEach((interest) => interests.add(interest));
      status.push({
        region: market.code,
        ok: false,
        stale: true,
        playlistCount: detail.playlists.length,
        error: error.message
      });
    }

    await writeJson(file, detail);
    playlistCount += detail.playlistCount;
    regions.push({
      code: market.code,
      name: market.name,
      source: `data/apple-regional/${market.code.toLowerCase()}.json`,
      playlistCount: detail.playlistCount,
      updatedAt: detail.updatedAt,
      stale: detail.stale
    });
    await sleep(200);
  }

  const index = {
    schemaVersion: 1,
    provider: "apple-music",
    generatedAt,
    regionCount: regions.length,
    playlistCount,
    interests: [...interests].sort(),
    regions
  };
  await writeJson(path.join(APPLE_REGIONAL_DIR, "index.json"), index);
  return { index, status, failedWithoutFallback };
}

async function buildAppleCountryChartFeeds(generatedAt) {
  const regions = [];
  const status = [];
  let trackCount = 0;

  for (const market of APPLE_COUNTRY_CHART_MARKETS) {
    const file = path.join(APPLE_COUNTRY_CHART_DIR, `${market.code.toLowerCase()}.json`);
    const previous = await readJson(file);
    const sourceUrl =
      `https://rss.marketingtools.apple.com/api/v2/${market.code.toLowerCase()}/music/most-played/100/songs.json`;
    let detail;

    try {
      const feed = await fetchJson(sourceUrl);
      const results = feed.feed?.results || [];
      if (results.length < 10) throw new Error(`${market.code} returned ${results.length} chart songs`);
      const tracks = results.slice(0, 100).map((item, index) => {
        const coverImage = appleHighResolutionArtworkUrl(item.artworkUrl100);
        assert(
          item.id && item.name && item.artistName && coverImage && item.url,
          `${market.code} returned an incomplete song at position ${index + 1}`
        );
        return {
          position: index + 1,
          id: `apple:${item.id}`,
          provider: "apple-music",
          appleId: item.id,
          title: item.name,
          artist: item.artistName,
          artistNames: [item.artistName],
          albumTitle: item.collectionName || item.albumName || "",
          releaseDate: item.releaseDate || null,
          coverImage,
          appleUrl: item.url,
          sourceUrl: item.url,
          explicit: item.contentAdvisoryRating === "Explicit",
          genres: (item.genres || []).map((genre) => genre.name).filter(Boolean),
          country: market.code,
          regions: [market.code]
        };
      });
      detail = {
        schemaVersion: 1,
        provider: "apple-music",
        chart: "country-top-songs",
        region: market.code,
        regionName: market.name,
        country: market.code,
        countryName: market.name,
        sourceUrl,
        updatedAt: toIsoDateOrFallback(feed.feed?.updated, generatedAt),
        checkedAt: generatedAt,
        status: "fresh",
        available: true,
        official: true,
        stale: false,
        error: null,
        providerError: null,
        trackCount: tracks.length,
        tracks
      };
      status.push({
        region: market.code,
        ok: true,
        status: "fresh",
        provider: "apple-music",
        available: true,
        official: true,
        stale: false,
        trackCount: tracks.length
      });
    } catch (error) {
      const previousIsValid =
        ["apple-music", "pulsedeck-curated"].includes(previous?.provider) &&
        previous?.chart === "country-top-songs" &&
        previous?.region === market.code &&
        previous?.available === true &&
        previous?.trackCount > 0 &&
        previous.trackCount === previous.tracks?.length;
      if (previousIsValid && previous.official) {
        detail = {
          ...previous,
          checkedAt: generatedAt,
          status: "stale",
          stale: true,
          error: error.message,
          providerError: error.message
        };
      } else {
        const tracks = buildPulseDeckCuratedCountryTracks(market.code, playlists);
        if (tracks.length >= 10) {
          detail = {
            schemaVersion: 1,
            provider: "pulsedeck-curated",
            chart: "country-top-songs",
            region: market.code,
            regionName: market.name,
            country: market.code,
            countryName: market.name,
            sourceUrl: "data/index.json",
            updatedAt: generatedAt,
            checkedAt: generatedAt,
            status: "curated",
            available: true,
            official: false,
            stale: false,
            error: null,
            providerError: error.message,
            trackCount: tracks.length,
            tracks
          };
        }
      }
      if (!detail && previousIsValid) {
        detail = {
          ...previous,
          checkedAt: generatedAt,
          status: "stale",
          stale: true,
          error: error.message,
          providerError: error.message
        };
      }
      if (!detail) {
        detail = {
          schemaVersion: 1,
          provider: "apple-music",
          chart: "country-top-songs",
          region: market.code,
          regionName: market.name,
          country: market.code,
          countryName: market.name,
          sourceUrl,
          updatedAt: null,
          checkedAt: generatedAt,
          status: "unavailable",
          available: false,
          official: false,
          stale: false,
          error: error.message,
          providerError: error.message,
          trackCount: 0,
          tracks: []
        };
      }
      status.push({
        region: market.code,
        ok: true,
        status: detail.status,
        provider: detail.provider,
        available: detail.available,
        official: detail.official,
        stale: detail.stale,
        trackCount: detail.trackCount,
        error: error.message
      });
    }

    await writeJson(file, detail);
    trackCount += detail.trackCount;
    regions.push({
      code: market.code,
      name: market.name,
      source: `data/apple-country-charts/${market.code.toLowerCase()}.json`,
      status: detail.status,
      provider: detail.provider,
      available: detail.available,
      official: detail.official,
      stale: detail.stale,
      trackCount: detail.trackCount,
      updatedAt: detail.updatedAt,
      checkedAt: detail.checkedAt
    });
    await sleep(200);
  }

  const index = {
    schemaVersion: 1,
    providers: ["apple-music", "pulsedeck-curated"],
    chart: "country-top-songs",
    generatedAt,
    regionCount: regions.length,
    availableRegionCount: regions.filter((region) => region.available).length,
    officialRegionCount: regions.filter((region) => region.official).length,
    curatedRegionCount: regions.filter((region) => region.status === "curated").length,
    staleRegionCount: regions.filter((region) => region.stale).length,
    trackCount,
    regions
  };
  await writeJson(path.join(APPLE_COUNTRY_CHART_DIR, "index.json"), index);
  return { index, status };
}

function buildPulseDeckCuratedCountryTracks(country, sourcePlaylists) {
  const ranked = new Map();
  let firstSeen = 0;
  for (const playlist of sourcePlaylists.filter((item) => item.regions?.includes(country))) {
    const seenInPlaylist = new Set();
    for (const track of playlist.tracks || []) {
      const artistNames = (track.artistNames || []).filter(Boolean);
      if (!track.title || !artistNames.length) continue;
      const key = track.spotifyId || `${track.title.toLowerCase()}|${artistNames.join(",").toLowerCase()}`;
      if (!seenInPlaylist.add(key)) continue;
      const current = ranked.get(key) || {
        track,
        coverImage: playlist.coverImage,
        sourceUrl: playlist.spotifyUrl,
        sourcePlaylists: [],
        interests: new Set(),
        bestPosition: Number.MAX_SAFE_INTEGER,
        firstSeen: firstSeen++
      };
      current.sourcePlaylists.push(playlist.slug);
      (playlist.interests || []).forEach((interest) => current.interests.add(interest));
      current.bestPosition = Math.min(current.bestPosition, track.position || Number.MAX_SAFE_INTEGER);
      ranked.set(key, current);
    }
  }
  return [...ranked.values()]
    .sort((left, right) =>
      right.sourcePlaylists.length - left.sourcePlaylists.length ||
      left.bestPosition - right.bestPosition ||
      left.firstSeen - right.firstSeen
    )
    .slice(0, 100)
    .map((item, index) => {
      const track = item.track;
      const artistNames = track.artistNames.filter(Boolean);
      const spotifyUrl = track.spotifyUrl || item.sourceUrl || null;
      return {
        position: index + 1,
        id: track.spotifyId ? `spotify:${track.spotifyId}` : `pulsedeck:${hashJson([track.title, artistNames]).slice(0, 16)}`,
        provider: "pulsedeck-curated",
        spotifyId: track.spotifyId || null,
        appleId: null,
        title: track.title,
        artist: artistNames.join(", "),
        artistNames,
        albumTitle: track.album?.name || "",
        releaseDate: track.album?.releaseDate || null,
        coverImage: track.album?.coverImage || item.coverImage,
        sourceUrl: spotifyUrl,
        spotifyUrl,
        appleUrl: null,
        explicit: Boolean(track.explicit),
        genres: [...item.interests].sort(),
        sourcePlaylistCount: item.sourcePlaylists.length,
        sourcePlaylists: item.sourcePlaylists,
        country,
        regions: [country]
      };
    });
}

async function buildAppleHeroFeeds(generatedAt) {
  const cards = [];
  for (const source of APPLE_HERO_SOURCES) {
    const file = path.join(APPLE_HERO_DIR, `${source.slug}.json`);
    const previous = await readJson(file);
    const appleUrl = `https://music.apple.com/us/room/${source.roomId}`;
    let tracks = [];
    let stale = false;

    try {
      const html = await fetchText(appleUrl, "text/html,application/xhtml+xml");
      tracks = extractAppleRoomTracks(html);
      if (tracks.length < source.minTracks) throw new Error(`${source.slug} returned ${tracks.length} tracks`);
    } catch (error) {
      if (!previous?.tracks?.length) throw error;
      tracks = previous.tracks;
      stale = true;
    }

    const detail = {
      schemaVersion: 1,
      slug: source.slug,
      title: source.title,
      subtitle: source.subtitle,
      category: source.category,
      roomId: source.roomId,
      appleUrl,
      market: MARKET,
      trackCount: tracks.length,
      updatedAt: stale ? previous.updatedAt : generatedAt,
      stale,
      tracks
    };
    await writeJson(file, detail);
    cards.push({
      slug: source.slug,
      title: source.title,
      subtitle: source.subtitle,
      category: source.category,
      roomId: source.roomId,
      appleUrl,
      trackCount: tracks.length,
      updatedAt: detail.updatedAt,
      stale
    });
  }

  const index = {
    schemaVersion: 1,
    generatedAt,
    market: MARKET,
    playlistCount: cards.length,
    playlists: cards
  };
  await writeJson(path.join(APPLE_HERO_DIR, "index.json"), index);
  return index;
}

async function buildAppleEditorialFeeds(generatedAt) {
  const shelves = [];
  for (const source of APPLE_EDITORIAL_SOURCES) {
    const file = path.join(APPLE_EDITORIAL_DIR, `${source.slug}.json`);
    const previous = await readJson(file);
    const appleUrl = `https://music.apple.com/us/room/${source.roomId}`;
    let items = [];
    let stale = false;

    try {
      const html = await fetchText(appleUrl, "text/html,application/xhtml+xml");
      items = extractAppleEditorialItems(html, source.slug);
      if (items.length < source.minItems) throw new Error(`${source.slug} returned ${items.length} items`);
      items = await buildAppleEditorialItemDetails(source, items, generatedAt, previous);
    } catch (error) {
      if (!previous?.items?.length) throw error;
      items = previous.items;
      stale = true;
    }
    stale ||= items.some((item) => item.stale);

    const detail = {
      schemaVersion: 1,
      slug: source.slug,
      title: source.title,
      subtitle: source.subtitle,
      category: source.category,
      roomId: source.roomId,
      appleUrl,
      market: MARKET,
      itemCount: items.length,
      updatedAt: stale ? previous.updatedAt : generatedAt,
      stale,
      items
    };
    await writeJson(file, detail);
    shelves.push({
      slug: source.slug,
      title: source.title,
      subtitle: source.subtitle,
      category: source.category,
      roomId: source.roomId,
      appleUrl,
      itemCount: items.length,
      updatedAt: detail.updatedAt,
      stale
    });
  }

  const index = {
    schemaVersion: 1,
    generatedAt,
    market: MARKET,
    shelfCount: shelves.length,
    shelves
  };
  await writeJson(path.join(APPLE_EDITORIAL_DIR, "index.json"), index);
  return index;
}

async function buildAppleEditorialItemDetails(source, items, generatedAt, previous) {
  const previousItems = new Map((previous?.items || []).map((item) => [item.appleUrl, item]));
  const detailDir = path.join(APPLE_EDITORIAL_DIR, source.slug);
  await mkdir(detailDir, { recursive: true });
  const withDetails = [];

  for (const item of items) {
    const detailSlug = editorialDetailSlug(item);
    const file = path.join(detailDir, `${detailSlug}.json`);
    const previousDetail = await readJson(file);
    let tracks = [];
    let stale = false;

    try {
      const html = await fetchText(item.appleUrl, "text/html,application/xhtml+xml");
      tracks = extractAppleSongTracks(html, item.coverImage).slice(0, APPLE_EDITORIAL_TRACK_LIMIT);
      if (!tracks.length) throw new Error(`${item.title} returned no tracks`);
    } catch (error) {
      if (!previousDetail?.tracks?.length) continue;
      tracks = previousDetail.tracks;
      stale = true;
    }
    const firstTrackCover = source.slug === "premium-playlists"
      ? appleHighResolutionArtworkUrl(tracks[0]?.album?.coverImage)
      : null;
    if (firstTrackCover) {
      tracks[0] = {
        ...tracks[0],
        album: { ...tracks[0].album, coverImage: firstTrackCover }
      };
    }
    const coverImage = firstTrackCover || item.coverImage;

    const detail = {
      schemaVersion: 1,
      slug: detailSlug,
      parentSlug: source.slug,
      title: item.title,
      subtitle: item.subtitle,
      kind: item.kind,
      coverImage,
      appleUrl: item.appleUrl,
      appleId: item.appleId,
      market: MARKET,
      trackCount: tracks.length,
      updatedAt: stale ? previousDetail.updatedAt : generatedAt,
      stale,
      tracks
    };
    await writeJson(file, detail);
    withDetails.push({
      ...item,
      coverImage,
      trackCount: tracks.length,
      detailSource: `data/apple-editorial/${source.slug}/${detailSlug}.json`,
      updatedAt: detail.updatedAt,
      stale
    });
    await sleep(40);
  }

  if (withDetails.length < source.minItems) throw new Error(`${source.slug} kept ${withDetails.length} playable item details`);
  return withDetails.map((item, index) => ({ ...item, position: index + 1 }));
}

function validateSources(items) {
  assert(Array.isArray(items), "sources/playlists.json must be an array");
  assert(items.length > 0, "expected at least one playlist source");

  const slugs = new Set();
  const ids = new Set();
  for (const item of items) {
    assert(SLUG_RE.test(item.slug || ""), `bad slug: ${item.slug}`);
    assert(!slugs.has(item.slug), `duplicate slug: ${item.slug}`);
    assert(PLAYLIST_ID_RE.test(item.playlistId || ""), `bad playlist id for ${item.slug}`);
    assert(!ids.has(item.playlistId), `duplicate playlist id: ${item.playlistId}`);
    assert(typeof item.title === "string" && item.title.trim(), `missing title for ${item.slug}`);
    assert(typeof item.category === "string" && item.category.trim(), `missing category for ${item.slug}`);
    assert(Array.isArray(item.interests) && item.interests.length > 0, `missing interests for ${item.slug}`);
    assert(
      item.interests.every((interest) => SLUG_RE.test(interest)) && new Set(item.interests).size === item.interests.length,
      `invalid interests for ${item.slug}`
    );
    assert(Array.isArray(item.regions) && item.regions.length > 0, `missing regions for ${item.slug}`);
    assert(
      item.regions.every((region) => region === "GLOBAL" || /^[A-Z]{2}$/.test(region)) &&
        new Set(item.regions).size === item.regions.length,
      `invalid regions for ${item.slug}`
    );
    slugs.add(item.slug);
    ids.add(item.playlistId);
  }
}

function validateInterestInference() {
  assert(inferAppleInterests("African Gospel").includes("gospel"), "Apple Gospel inference failed");
  assert(inferAppleInterests("R&B Hits").includes("rnb"), "Apple R&B inference failed");
  assert(inferAppleInterests("Viral Amapiano").includes("amapiano"), "Apple Amapiano inference failed");
}

function validateAppleRegionalMarkets() {
  assert(
    new Set(APPLE_REGIONAL_MARKETS.map((market) => market.code)).size === APPLE_REGIONAL_MARKETS.length,
    "Apple regional markets contain a duplicate country code"
  );
  assert(
    APPLE_REGIONAL_MARKETS.every((market) => /^[A-Z]{2}$/.test(market.code) && market.name),
    "Apple regional markets contain an invalid country"
  );
}

function validateAppleCountryChartMarkets() {
  assert(APPLE_COUNTRY_CHART_MARKETS.length === 51, "Expected 51 Apple country charts");
  assert(
    new Set(APPLE_COUNTRY_CHART_MARKETS.map((market) => market.code)).size === APPLE_COUNTRY_CHART_MARKETS.length,
    "Apple country charts contain a duplicate country code"
  );
  assert(
    APPLE_COUNTRY_CHART_MARKETS.every((market) => /^[A-Z]{2}$/.test(market.code) && market.name),
    "Apple country charts contain an invalid country"
  );
}

function validatePlaylistOutput(playlist) {
  assert(playlist.coverImage, `${playlist.slug} is missing cover art`);
  assert(Array.isArray(playlist.tracks) && playlist.tracks.length > 0, `${playlist.slug} returned no tracks`);
  assert(playlist.trackCount === playlist.tracks.length, `${playlist.slug} has a mismatched track count`);
}

function validateYouTubeSources(items) {
  assert(Array.isArray(items), "sources/youtube-playlists.json must be an array");
  assert(items.length > 0, "expected at least one YouTube playlist source");

  const slugs = new Set();
  const ids = new Set();
  for (const item of items) {
    assert(SLUG_RE.test(item.slug || ""), `bad YouTube slug: ${item.slug}`);
    assert(!slugs.has(item.slug), `duplicate YouTube slug: ${item.slug}`);
    assert(YOUTUBE_PLAYLIST_ID_RE.test(item.playlistId || ""), `bad YouTube playlist id for ${item.slug}`);
    assert(!ids.has(item.playlistId), `duplicate YouTube playlist id: ${item.playlistId}`);
    assert(typeof item.title === "string" && item.title.trim(), `missing YouTube title for ${item.slug}`);
    assert(typeof item.category === "string" && item.category.trim(), `missing YouTube category for ${item.slug}`);
    assert(Array.isArray(item.interests) && item.interests.length > 0, `missing YouTube interests for ${item.slug}`);
    assert(
      item.interests.every((interest) => SLUG_RE.test(interest)) &&
        new Set(item.interests).size === item.interests.length,
      `invalid YouTube interests for ${item.slug}`
    );
    assert(Array.isArray(item.regions) && item.regions.length > 0, `missing YouTube regions for ${item.slug}`);
    assert(
      item.regions.every((region) => region === "GLOBAL" || /^[A-Z]{2}$/.test(region)) &&
        new Set(item.regions).size === item.regions.length,
      `invalid YouTube regions for ${item.slug}`
    );
    assert(
      Number.isInteger(item.minTracks) && item.minTracks > 0 && item.minTracks <= 100,
      `invalid YouTube minTracks for ${item.slug}`
    );
    slugs.add(item.slug);
    ids.add(item.playlistId);
  }
}

function validatePodcastGenres(items) {
  assert(Array.isArray(items) && items.length > 0, "sources/podcast-genres.json must be a non-empty array");
  assert(/^[A-Z]{2}$/.test(PODCAST_MARKET), `invalid PODCAST_MARKET: ${PODCAST_MARKET}`);

  const slugs = new Set();
  const ids = new Set();
  for (const item of items) {
    assert(SLUG_RE.test(item.slug || ""), `bad podcast genre slug: ${item.slug}`);
    assert(!slugs.has(item.slug), `duplicate podcast genre slug: ${item.slug}`);
    assert(typeof item.title === "string" && item.title.trim(), `missing podcast genre title for ${item.slug}`);
    assert(
      APPLE_PODCAST_GENRE_ID_RE.test(item.appleGenreId || ""),
      `bad Apple podcast genre id for ${item.slug}`
    );
    assert(!ids.has(item.appleGenreId), `duplicate Apple podcast genre id: ${item.appleGenreId}`);
    slugs.add(item.slug);
    ids.add(item.appleGenreId);
  }
}

function validatePodcastSources(items, configuredGenres) {
  assert(Array.isArray(items) && items.length > 0, "sources/podcasts.json must be a non-empty array");
  const validGenres = new Set(configuredGenres.map((genre) => genre.slug));
  const slugs = new Set();
  const feedUrls = new Set();

  for (const item of items) {
    assert(SLUG_RE.test(item.slug || ""), `bad podcast slug: ${item.slug}`);
    assert(!slugs.has(item.slug), `duplicate podcast slug: ${item.slug}`);
    assert(typeof item.title === "string" && item.title.trim(), `missing podcast title for ${item.slug}`);
    assert(isPublicHttpsUrl(item.feedUrl), `invalid podcast feed URL for ${item.slug}`);
    assert(!feedUrls.has(item.feedUrl), `duplicate podcast feed URL: ${item.feedUrl}`);
    assert(Array.isArray(item.genres) && item.genres.length > 0, `missing podcast genres for ${item.slug}`);
    assert(
      item.genres.every((genre) => validGenres.has(genre)) &&
        new Set(item.genres).size === item.genres.length,
      `invalid podcast genres for ${item.slug}`
    );
    assert(Array.isArray(item.topics) && item.topics.length > 0, `missing podcast topics for ${item.slug}`);
    assert(
      item.topics.every((topic) => SLUG_RE.test(topic)) && new Set(item.topics).size === item.topics.length,
      `invalid podcast topics for ${item.slug}`
    );
    assert(Array.isArray(item.regions) && item.regions.length > 0, `missing podcast regions for ${item.slug}`);
    assert(
      item.regions.every((region) => region === "GLOBAL" || /^[A-Z]{2}$/.test(region)) &&
        new Set(item.regions).size === item.regions.length,
      `invalid podcast regions for ${item.slug}`
    );
    assert(Array.isArray(item.languages) && item.languages.length > 0, `missing podcast languages for ${item.slug}`);
    assert(
      item.languages.every((language) => /^[a-z]{2,3}(?:-[a-z]{2})?$/.test(language)) &&
        new Set(item.languages).size === item.languages.length,
      `invalid podcast languages for ${item.slug}`
    );
    assert(
      Number.isInteger(item.minEpisodes) && item.minEpisodes > 0 && item.minEpisodes <= PODCAST_EPISODE_LIMIT,
      `invalid podcast minEpisodes for ${item.slug}`
    );
    slugs.add(item.slug);
    feedUrls.add(item.feedUrl);
  }
}

function validatePodcastParser() {
  const source = {
    slug: "parser-check",
    title: "Parser check",
    feedUrl: "https://example.com/feed.xml",
    genres: ["news"],
    topics: ["parser-check"],
    regions: ["GLOBAL"],
    languages: ["en"],
    minEpisodes: 1
  };
  const xml = `<?xml version="1.0"?>
    <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
      <channel>
        <title>Parser &amp; Check</title>
        <link>https://example.com/show</link>
        <itunes:author>PulseDeck</itunes:author>
        <itunes:image href="https://example.com/cover.jpg"/>
        <itunes:category text="News"><itunes:category text="Daily News"/></itunes:category>
        <item>
          <guid>episode-1</guid>
          <title><![CDATA[Morning <Update>]]></title>
          <pubDate>Wed, 29 Jul 2026 08:00:00 GMT</pubDate>
          <itunes:duration>1:02</itunes:duration>
          <enclosure url="https://example.com/episode.mp3" type="audio/mpeg"/>
        </item>
      </channel>
    </rss>`;
  const parsed = parsePodcastFeed(xml, source, "2026-07-29T09:00:00.000Z");
  assert(parsed.title === "Parser & Check", "Podcast title parser failed");
  assert(parsed.publisher === "PulseDeck", "Podcast publisher parser failed");
  assert(parsed.episodes.length === 1, "Podcast episode parser failed");
  assert(parsed.episodes[0].durationMs === 62000, "Podcast duration parser failed");
  assert(parsed.rssCategories.includes("Daily News"), "Podcast category parser failed");
}

function validateYouTubeParser() {
  const initialData = {
    sidebar: {
      playlistSidebarPrimaryInfoRenderer: { title: { runs: [{ text: "Parser check" }] } },
      playlistSidebarSecondaryInfoRenderer: {
        videoOwner: {
          videoOwnerRenderer: {
            title: { runs: [{ text: "PulseDeck" }] },
            navigationEndpoint: { browseEndpoint: { canonicalBaseUrl: "/@PulseDeck" } }
          }
        }
      }
    },
    contents: [
      {
        lockupViewModel: {
          contentType: "LOCKUP_CONTENT_TYPE_VIDEO",
          contentId: "abcdefghijk",
          contentImage: {
            thumbnailViewModel: {
              overlays: [{
                thumbnailBottomOverlayViewModel: {
                  badges: [{ thumbnailBadgeViewModel: { text: "1:02" } }]
                }
              }]
            }
          },
          metadata: {
            lockupMetadataViewModel: {
              title: { content: "Test song" },
              metadata: {
                contentMetadataViewModel: {
                  metadataRows: [{ metadataParts: [{ text: { content: "Test artist" } }] }]
                }
              }
            }
          }
        }
      },
      {
        playlistVideoRenderer: {
          videoId: "lmnopqrstuv",
          title: { runs: [{ text: "Legacy song" }] },
          shortBylineText: { runs: [{ text: "Legacy artist" }] },
          lengthText: { simpleText: "2:03" }
        }
      }
    ]
  };
  const parsed = parseYouTubePlaylistPage(
    `<script>var ytInitialData = ${JSON.stringify(initialData)};</script>`,
    { title: "Fallback", playlistId: "PLabcdefghijk" }
  );
  assert(parsed.title === "Parser check", "YouTube title parser failed");
  assert(parsed.owner.name === "PulseDeck", "YouTube owner parser failed");
  assert(parsed.tracks.length === 2, "YouTube track parser failed");
  assert(parsed.tracks[0].durationMs === 62000, "YouTube duration parser failed");
  assert(parsed.tracks[1].durationMs === 123000, "Legacy YouTube parser failed");
  const richerPrevious = { youtubePlaylistId: "PLabcdefghijk", tracks: [{}, {}] };
  const source = { playlistId: "PLabcdefghijk" };
  assert(
    shouldRetainYouTubeTracks(richerPrevious, source, [{}], true),
    "YouTube truncated-result retention failed"
  );
  assert(
    !shouldRetainYouTubeTracks(richerPrevious, source, [{}], false),
    "YouTube complete playlist shrink must not retain old tracks"
  );
}

async function buildPodcastFeeds(configuredSources, generatedAt) {
  const shows = [];
  const status = [];
  let failedWithoutFallback = false;

  for (const source of configuredSources) {
    const file = path.join(PODCAST_SHOW_DIR, `${source.slug}.json`);
    const previous = await readJson(file);

    try {
      const xml = await fetchText(
        source.feedUrl,
        "application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.1"
      );
      const show = parsePodcastFeed(xml, source, generatedAt, previous);
      validatePodcastOutput(show, source.minEpisodes);
      await writeJson(file, show);
      shows.push(show);
      status.push({
        kind: "show",
        slug: source.slug,
        ok: true,
        stale: false,
        episodeCount: show.episodeCount,
        snapshotId: show.snapshotId
      });
    } catch (error) {
      if (previous?.feedUrl === source.feedUrl && previous?.episodes?.length) {
        const fallback = {
          ...previous,
          genres: source.genres,
          topics: source.topics,
          regions: source.regions,
          languages: source.languages,
          updatedAt: samePodcastTaxonomy(previous, source) ? previous.updatedAt : generatedAt,
          stale: true
        };
        await writeJson(file, fallback);
        shows.push(fallback);
        status.push({
          kind: "show",
          slug: source.slug,
          ok: false,
          stale: true,
          episodeCount: fallback.episodeCount,
          error: error.message
        });
        continue;
      }

      failedWithoutFallback = true;
      status.push({ kind: "show", slug: source.slug, ok: false, stale: false, error: error.message });
    }
  }

  return {
    index: {
      showCount: shows.length,
      genres: [...new Set(shows.flatMap((show) => show.genres))].sort(),
      topics: [...new Set(shows.flatMap((show) => show.topics))].sort(),
      regions: [...new Set(shows.flatMap((show) => show.regions))].sort(),
      languages: [...new Set(shows.flatMap((show) => show.languages))].sort(),
      shows: shows.map(toPodcastIndexCard)
    },
    status,
    failedWithoutFallback
  };
}

async function buildPodcastGenreFeeds(configuredGenres, generatedAt) {
  const genres = [];
  const status = [];
  let showPlacementCount = 0;
  let failedWithoutFallback = false;

  for (const source of configuredGenres) {
    const file = path.join(PODCAST_GENRE_DIR, `${source.slug}.json`);
    const previous = await readJson(file);
    const sourceUrl =
      `https://itunes.apple.com/${PODCAST_MARKET.toLowerCase()}/rss/toppodcasts/` +
      `limit=${PODCAST_CHART_LIMIT}/genre=${source.appleGenreId}/json`;
    let detail;

    try {
      const feed = await fetchJson(sourceUrl);
      detail = parseApplePodcastGenreFeed(feed, source, sourceUrl, generatedAt);
      validatePodcastGenreOutput(detail);
      status.push({
        kind: "genre-chart",
        slug: source.slug,
        ok: true,
        stale: false,
        showCount: detail.showCount
      });
    } catch (error) {
      if (!previous?.shows?.length || previous.appleGenreId !== source.appleGenreId) {
        failedWithoutFallback = true;
        status.push({
          kind: "genre-chart",
          slug: source.slug,
          ok: false,
          stale: false,
          showCount: 0,
          error: error.message
        });
        continue;
      }
      detail = { ...previous, genreName: source.title, stale: true };
      status.push({
        kind: "genre-chart",
        slug: source.slug,
        ok: false,
        stale: true,
        showCount: detail.showCount,
        error: error.message
      });
    }

    await writeJson(file, detail);
    showPlacementCount += detail.showCount;
    genres.push({
      slug: source.slug,
      title: source.title,
      appleGenreId: source.appleGenreId,
      source: `data/podcasts/genres/${source.slug}.json`,
      chartShowCount: detail.showCount,
      updatedAt: detail.updatedAt,
      stale: detail.stale
    });
    await sleep(100);
  }

  return {
    index: {
      genreCount: genres.length,
      showPlacementCount,
      genres
    },
    status,
    failedWithoutFallback
  };
}

function parsePodcastFeed(xml, source, generatedAt, previous = null) {
  const document = PODCAST_XML_PARSER.parse(xml);
  const channel = document.rss?.channel || document.feed;
  assert(channel && typeof channel === "object", `${source.slug} did not return an RSS or Atom feed`);

  const title = cleanPodcastText(xmlTextValue(channel.title) || source.title, 200);
  const publisher = cleanPodcastText(
    xmlTextValue(channel["itunes:author"]) ||
      xmlTextValue(channel.author?.name) ||
      xmlTextValue(channel.managingEditor) ||
      source.title,
    200
  );
  const description = cleanPodcastText(
    xmlTextValue(channel["itunes:summary"]) ||
      xmlTextValue(channel.description) ||
      xmlTextValue(channel.subtitle),
    2000
  );
  const coverImage = firstPublicHttpsUrl([
    xmlAttributeValue(channel["itunes:image"], "href"),
    xmlTextValue(channel.image?.url),
    xmlAttributeValue(channel.image, "href"),
    xmlTextValue(channel.logo),
    xmlTextValue(channel.icon),
    previous?.coverImage
  ]);
  const websiteUrl = firstPublicHttpsUrl([
    xmlLinkUrl(channel.link, "alternate"),
    xmlLinkUrl(channel.link),
    previous?.websiteUrl
  ]);
  const rawItems = xmlArray(channel.item || channel.entry);
  const episodes = [];
  const seenIds = new Set();
  const seenAudioUrls = new Set();

  for (const episode of rawItems
    .map((item) => toPodcastEpisode(item, coverImage))
    .filter(Boolean)
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))) {
    if (seenIds.has(episode.id) || seenAudioUrls.has(episode.audioUrl)) continue;
    seenIds.add(episode.id);
    seenAudioUrls.add(episode.audioUrl);
    episodes.push({ ...episode, position: episodes.length + 1 });
    if (episodes.length === PODCAST_EPISODE_LIMIT) break;
  }

  const feedUpdatedAt = toIsoDateOrNull(
    xmlTextValue(channel.lastBuildDate) ||
      xmlTextValue(channel.pubDate) ||
      xmlTextValue(channel.updated)
  );
  const rssCategories = collectPodcastCategories(channel["itunes:category"] || channel.category);
  const snapshotId = `rss:${hashJson({
    title,
    publisher,
    coverImage,
    episodes: episodes.map((episode) => [episode.id, episode.audioUrl, episode.publishedAt])
  })}`;

  return {
    schemaVersion: 1,
    provider: "podcast-rss",
    slug: source.slug,
    title,
    publisher,
    description,
    genres: source.genres,
    topics: source.topics,
    regions: source.regions,
    languages: source.languages,
    rssCategories,
    coverImage,
    feedUrl: source.feedUrl,
    websiteUrl,
    copyright: cleanPodcastText(xmlTextValue(channel.copyright), 500) || null,
    snapshotId,
    feedUpdatedAt,
    latestEpisodeAt: episodes[0]?.publishedAt || null,
    rssEpisodeTotal: rawItems.length,
    episodeCount: episodes.length,
    updatedAt:
      previous?.snapshotId === snapshotId && samePodcastTaxonomy(previous, source)
        ? previous.updatedAt
        : generatedAt,
    stale: false,
    episodes
  };
}

function parseApplePodcastGenreFeed(feed, source, sourceUrl, generatedAt) {
  const entries = xmlArray(feed.feed?.entry);
  const updatedAt = toIsoDateOrFallback(feed.feed?.updated?.label, generatedAt);
  const shows = entries.map((entry, index) => toApplePodcastShow(entry, source, index + 1));

  return {
    schemaVersion: 1,
    provider: "apple-podcasts",
    genre: source.slug,
    genreName: source.title,
    appleGenreId: source.appleGenreId,
    market: PODCAST_MARKET,
    sourceUrl,
    updatedAt,
    stale: false,
    showCount: shows.length,
    shows
  };
}

function toPodcastEpisode(item, fallbackCoverImage) {
  const enclosure =
    xmlArray(item.enclosure).find((value) => xmlAttributeValue(value, "url")) ||
    xmlArray(item.link).find((value) => xmlAttributeValue(value, "rel") === "enclosure") ||
    xmlArray(item["media:content"]).find((value) => xmlAttributeValue(value, "url"));
  const audioUrl = firstPublicHttpsUrl([
    xmlAttributeValue(enclosure, "url"),
    xmlAttributeValue(enclosure, "href")
  ]);
  const title = cleanPodcastText(xmlTextValue(item.title), 300);
  const publishedAt = toIsoDateOrNull(
    xmlTextValue(item.pubDate) || xmlTextValue(item.published) || xmlTextValue(item.updated)
  );
  if (!audioUrl || !title || !publishedAt) return null;

  const rawId = xmlTextValue(item.guid) || xmlTextValue(item.id);
  const websiteUrl = firstPublicHttpsUrl([xmlLinkUrl(item.link, "alternate"), xmlLinkUrl(item.link)]);
  const coverImage = firstPublicHttpsUrl([
    xmlAttributeValue(item["itunes:image"], "href"),
    xmlAttributeValue(item["media:thumbnail"], "url"),
    fallbackCoverImage
  ]);
  const durationText = xmlTextValue(item["itunes:duration"]);

  return {
    position: 0,
    id: rawId || `episode:${hashJson([audioUrl, title, publishedAt])}`,
    title,
    description: cleanPodcastText(
      xmlTextValue(item["content:encoded"]) ||
        xmlTextValue(item["itunes:summary"]) ||
        xmlTextValue(item.description) ||
        xmlTextValue(item.summary) ||
        xmlTextValue(item.content),
      4000
    ),
    publishedAt,
    durationMs: durationTextToMs(durationText),
    explicit: /^(yes|true|explicit)$/i.test(xmlTextValue(item["itunes:explicit"])),
    coverImage,
    audioUrl,
    audioType: xmlAttributeValue(enclosure, "type") || "audio/mpeg",
    websiteUrl
  };
}

function toApplePodcastShow(entry, source, position) {
  const appleId = String(entry.id?.attributes?.["im:id"] || entry.id?.["im:id"] || "");
  const title = cleanPodcastText(entry["im:name"]?.label, 300);
  const publisher = cleanPodcastText(entry["im:artist"]?.label, 200);
  const appleUrl =
    xmlArray(entry.link).find((link) => link?.attributes?.rel === "alternate")?.attributes?.href ||
    entry.link?.attributes?.href ||
    entry.id?.label ||
    null;
  const coverImage = appleHighResolutionArtworkUrl(xmlArray(entry["im:image"]).at(-1)?.label);
  assert(appleId && title && publisher && coverImage && isPublicHttpsUrl(appleUrl), `${source.slug} returned a bad show`);

  return {
    position,
    id: `apple-podcast:${appleId}`,
    provider: "apple-podcasts",
    appleId,
    title,
    publisher,
    description: cleanPodcastText(entry.summary?.label, 2000),
    coverImage,
    appleUrl,
    genres: [source.slug],
    appleCategory: cleanPodcastText(entry.category?.attributes?.label, 100) || source.title,
    regions: [PODCAST_MARKET],
    latestReleaseAt: toIsoDateOrNull(entry["im:releaseDate"]?.label)
  };
}

function validatePodcastOutput(show, minEpisodes) {
  assert(show.provider === "podcast-rss", `${show.slug} has the wrong podcast provider`);
  assert(isPublicHttpsUrl(show.coverImage), `${show.slug} is missing secure podcast artwork`);
  assert(show.episodeCount >= minEpisodes, `${show.slug} returned fewer than ${minEpisodes} podcast episodes`);
  assert(show.episodeCount === show.episodes.length, `${show.slug} has a mismatched podcast episode count`);
  assert(
    show.episodes.every((episode) => episode.title && episode.publishedAt && isPublicHttpsUrl(episode.audioUrl)),
    `${show.slug} has an incomplete podcast episode`
  );
}

function validatePodcastGenreOutput(detail) {
  assert(detail.showCount >= 10, `${detail.genre} returned only ${detail.showCount} chart shows`);
  assert(detail.showCount === detail.shows.length, `${detail.genre} has a mismatched chart show count`);
  assert(
    detail.shows.every(
      (show, index) =>
        show.position === index + 1 &&
        show.provider === "apple-podcasts" &&
        show.appleId &&
        show.title &&
        show.publisher &&
        isPublicHttpsUrl(show.coverImage) &&
        isPublicHttpsUrl(show.appleUrl)
    ),
    `${detail.genre} has an incomplete chart show`
  );
}

function toPodcastIndexCard(show) {
  return {
    provider: show.provider,
    slug: show.slug,
    title: show.title,
    publisher: show.publisher,
    description: show.description,
    genres: show.genres,
    topics: show.topics,
    regions: show.regions,
    languages: show.languages,
    coverImage: show.coverImage,
    feedUrl: show.feedUrl,
    websiteUrl: show.websiteUrl,
    snapshotId: show.snapshotId,
    latestEpisodeAt: show.latestEpisodeAt,
    episodeCount: show.episodeCount,
    detailSource: `data/podcasts/shows/${show.slug}.json`,
    updatedAt: show.updatedAt,
    stale: Boolean(show.stale)
  };
}

function samePodcastTaxonomy(show, source) {
  return sameStringArray(show?.genres, source.genres) &&
    sameStringArray(show?.topics, source.topics) &&
    sameStringArray(show?.regions, source.regions) &&
    sameStringArray(show?.languages, source.languages);
}

function collectPodcastCategories(value) {
  const categories = new Set();
  const visit = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === "object") {
      const name = xmlAttributeValue(node, "text") || xmlTextValue(node);
      if (name) categories.add(name);
      Object.entries(node)
        .filter(([key]) => key === "itunes:category" || key === "category")
        .forEach(([, child]) => visit(child));
      return;
    }
    const name = cleanPodcastText(node, 100);
    if (name) categories.add(name);
  };
  visit(value);
  return [...categories];
}

function xmlArray(value) {
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
}

function xmlTextValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return xmlTextValue(value[0]);
  if (typeof value === "object") return xmlTextValue(value["#text"]);
  return "";
}

function xmlAttributeValue(value, key) {
  if (!value || typeof value !== "object") return "";
  return String(value[key] || value.attributes?.[key] || "").trim();
}

function xmlLinkUrl(value, relation = null) {
  for (const link of xmlArray(value)) {
    if (typeof link === "string" && !relation) return link.trim();
    const rel = xmlAttributeValue(link, "rel");
    const href = xmlAttributeValue(link, "href");
    if (href && (!relation || rel === relation || (!rel && relation === "alternate"))) return href;
    const text = xmlTextValue(link);
    if (text && !relation) return text;
  }
  return "";
}

function cleanPodcastText(value, maxLength) {
  return decodeHtml(stripHtml(xmlTextValue(value))).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function firstPublicHttpsUrl(values) {
  return values.find(isPublicHttpsUrl) || null;
}

function isPublicHttpsUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || hostname === "localhost" || hostname.endsWith(".local")) return false;
    if (/^(?:10|127)\./.test(hostname) || /^192\.168\./.test(hostname)) return false;
    const private172 = /^172\.(\d{1,3})\./.exec(hostname);
    return !private172 || Number(private172[1]) < 16 || Number(private172[1]) > 31;
  } catch {
    return false;
  }
}

function toIsoDateOrNull(value) {
  const timestamp = Date.parse(value);
  return value && !Number.isNaN(timestamp) ? new Date(timestamp).toISOString() : null;
}

async function buildYouTubeFeeds(configuredSources, generatedAt) {
  const playlists = [];
  const status = [];
  let failedWithoutFallback = false;

  for (const source of configuredSources) {
    const file = path.join(YOUTUBE_PLAYLIST_DIR, `${source.slug}.json`);
    const previous = await readJson(file);

    try {
      const playlist = await buildYouTubePlaylist(source, previous, generatedAt);
      validateYouTubePlaylistOutput(playlist, source.minTracks);
      await writeJson(file, playlist);
      playlists.push(playlist);
      status.push({
        slug: source.slug,
        ok: !playlist.stale,
        stale: playlist.stale,
        fetchMode: playlist.fetchMode,
        contentComplete: playlist.contentComplete,
        contentTruncated: playlist.contentTruncated,
        trackCount: playlist.trackCount,
        youtubeItemTotal: playlist.youtubeItemTotal,
        snapshotId: playlist.snapshotId
      });
    } catch (error) {
      if (previous?.youtubePlaylistId === source.playlistId) {
        const fallback = {
          ...previous,
          category: source.category,
          interests: source.interests,
          regions: source.regions,
          updatedAt: sameTaxonomy(previous, source) ? previous.updatedAt : generatedAt,
          stale: true
        };
        await writeJson(file, fallback);
        playlists.push(fallback);
        status.push({ slug: source.slug, ok: false, stale: true, error: error.message });
        continue;
      }

      failedWithoutFallback = true;
      status.push({ slug: source.slug, ok: false, stale: false, error: error.message });
    }
  }

  const index = {
    schemaVersion: 1,
    provider: "youtube",
    generatedAt,
    playlistCount: playlists.length,
    interests: [...new Set(configuredSources.flatMap((source) => source.interests))].sort(),
    regions: [...new Set(configuredSources.flatMap((source) => source.regions))].sort(),
    playlists: playlists.map(toYouTubeIndexCard)
  };
  await writeJson(path.join(YOUTUBE_DIR, "index.json"), index);
  return { index, status, failedWithoutFallback };
}

async function buildYouTubePlaylist(source, previous, generatedAt) {
  const youtubeUrl = youtubePlaylistUrl(source.playlistId);
  const parsed = await fetchPublicYouTubePlaylist(source);

  let tracks = parsed.tracks;
  let contentComplete = parsed.contentComplete;
  let contentTruncated = parsed.contentTruncated;
  let youtubeItemTotal = parsed.youtubeItemTotal;
  let fetchMode = parsed.fetchMode;
  let retained = false;
  if (shouldRetainYouTubeTracks(previous, source, tracks, contentTruncated)) {
    tracks = previous.tracks;
    contentComplete = Boolean(previous.contentComplete);
    contentTruncated = Boolean(previous.contentTruncated);
    youtubeItemTotal = Math.max(previous.youtubeItemTotal || 0, youtubeItemTotal || 0, tracks.length);
    fetchMode = `${fetchMode}+retained`;
    retained = true;
  }

  const snapshotId = `public:${hashJson({
    playlistId: source.playlistId,
    title: parsed.title,
    owner: parsed.owner.name,
    tracks: tracks.map((track) => [track.youtubeVideoId, track.title])
  })}`;

  return {
    schemaVersion: 1,
    provider: "youtube",
    slug: source.slug,
    title: parsed.title,
    category: source.category,
    interests: source.interests,
    regions: source.regions,
    youtubePlaylistId: source.playlistId,
    youtubeUrl,
    youtubeMusicUrl: youtubePlaylistUrl(source.playlistId, true),
    embedUrl: `https://www.youtube.com/embed/videoseries?list=${source.playlistId}`,
    owner: parsed.owner,
    coverImage: parsed.coverImage || tracks[0]?.coverImage || null,
    snapshotId,
    fetchMode,
    contentMode: "videos",
    contentComplete,
    contentTruncated,
    tracksAvailable: tracks.length > 0,
    trackCount: tracks.length,
    youtubeItemTotal: Math.max(youtubeItemTotal || 0, tracks.length),
    updatedAt: previous?.snapshotId === snapshotId && sameTaxonomy(previous, source)
      ? previous.updatedAt
      : generatedAt,
    stale: retained,
    tracks
  };
}

function shouldRetainYouTubeTracks(previous, source, tracks, contentTruncated) {
  return Boolean(
    contentTruncated &&
    previous?.youtubePlaylistId === source.playlistId &&
    previous.tracks?.length > tracks.length
  );
}

async function fetchPublicYouTubePlaylist(source) {
  const youtubeUrl = youtubePlaylistUrl(source.playlistId);
  const [html, oembed] = await Promise.all([
    fetchText(`${youtubeUrl}&hl=en&gl=US`, "text/html,application/xhtml+xml"),
    fetchJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`).catch(() => null)
  ]);
  const parsed = parseYouTubePlaylistPage(html, source);
  return {
    ...parsed,
    title: oembed?.title || parsed.title,
    owner: {
      ...parsed.owner,
      name: oembed?.author_name || parsed.owner.name
    },
    coverImage: oembed?.thumbnail_url || parsed.coverImage,
    fetchMode: "public"
  };
}

function parseYouTubePlaylistPage(html, source) {
  const initialData = extractYouTubeInitialData(html);
  const primary = collectByKey(initialData, "playlistSidebarPrimaryInfoRenderer")[0];
  const secondary = collectByKey(initialData, "playlistSidebarSecondaryInfoRenderer")[0];
  const metadata = collectByKey(initialData, "playlistMetadataRenderer")[0];
  const ownerRenderer = secondary?.videoOwner?.videoOwnerRenderer;
  const ownerPath = ownerRenderer?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl;
  const owner = {
    name: textValue(ownerRenderer?.title) || null,
    youtubeUrl: typeof ownerPath === "string" ? new URL(ownerPath, "https://www.youtube.com").href : null
  };
  const tracks = [];
  const seen = new Set();

  for (const view of collectByKey(initialData, "lockupViewModel")) {
    if (view?.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO" || seen.has(view.contentId)) continue;
    const track = toYouTubeTrack(view, source.playlistId, owner.name);
    if (!track) continue;
    seen.add(track.youtubeVideoId);
    tracks.push({ ...track, position: tracks.length + 1 });
  }
  for (const renderer of collectByKey(initialData, "playlistVideoRenderer")) {
    const track = toLegacyYouTubeTrack(renderer, source.playlistId);
    if (!track || seen.has(track.youtubeVideoId)) continue;
    seen.add(track.youtubeVideoId);
    tracks.push({ ...track, position: tracks.length + 1 });
  }

  const reportedTotal = numberFromText(textValue(primary?.stats?.[0])) || tracks.length;
  const contentComplete = tracks.length >= reportedTotal;

  // ponytail: private continuation results are incomplete/client-dependent; keep the official playlist link for the rest.
  return {
    title: textValue(primary?.title) || metadata?.title || source.title,
    owner,
    coverImage: tracks[0]?.coverImage || null,
    tracks,
    youtubeItemTotal: Math.max(reportedTotal, tracks.length),
    contentComplete,
    contentTruncated: !contentComplete
  };
}

function extractYouTubeInitialData(html) {
  for (const marker of ["var ytInitialData = ", "window[\"ytInitialData\"] = ", "ytInitialData = "]) {
    const start = html.indexOf(marker);
    const end = start < 0 ? -1 : html.indexOf(";</script>", start);
    if (start >= 0 && end > start) return JSON.parse(html.slice(start + marker.length, end));
  }
  throw new Error("YouTube page did not expose ytInitialData");
}

function collectByKey(root, key) {
  const matches = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (!Array.isArray(node) && node[key]) matches.push(node[key]);
    const values = Array.isArray(node) ? node : Object.values(node);
    for (let index = values.length - 1; index >= 0; index -= 1) stack.push(values[index]);
  }
  return matches;
}

function toYouTubeTrack(view, playlistId, ownerName) {
  const videoId = view.contentId;
  const metadata = view.metadata?.lockupMetadataViewModel;
  const title = metadata?.title?.content;
  if (!videoId || !title) return null;

  const byline = metadata?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content;
  const durationText = collectByKey(view, "thumbnailBadgeViewModel")
    .map((badge) => badge?.text)
    .find((text) => /^\d{1,2}:\d{2}(?::\d{2})?$/.test(text || "")) || null;
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`;
  const youtubeMusicUrl = `https://music.youtube.com/watch?v=${videoId}&list=${playlistId}`;

  return {
    position: 0,
    youtubeVideoId: videoId,
    title,
    artistNames: byline || ownerName ? [byline || ownerName] : [],
    coverImage: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    durationText,
    durationMs: durationTextToMs(durationText),
    youtubeUrl,
    youtubeMusicUrl
  };
}

function toLegacyYouTubeTrack(renderer, playlistId) {
  const videoId = renderer.videoId;
  const title = textValue(renderer.title);
  if (!videoId || !title || title === "Deleted video" || title === "Private video") return null;
  const byline = textValue(renderer.shortBylineText);
  const durationText = textValue(renderer.lengthText);
  return {
    position: 0,
    youtubeVideoId: videoId,
    title,
    artistNames: byline ? [byline] : [],
    coverImage: bestYouTubeThumbnail(renderer.thumbnail?.thumbnails) ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    durationText,
    durationMs: durationTextToMs(durationText),
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`,
    youtubeMusicUrl: `https://music.youtube.com/watch?v=${videoId}&list=${playlistId}`
  };
}

function validateYouTubePlaylistOutput(playlist, minTracks) {
  assert(playlist.coverImage, `${playlist.slug} is missing YouTube cover art`);
  assert(playlist.trackCount >= minTracks, `${playlist.slug} returned fewer than ${minTracks} YouTube tracks`);
  assert(playlist.trackCount === playlist.tracks.length, `${playlist.slug} has a mismatched YouTube track count`);
  assert(
    typeof playlist.contentComplete === "boolean" && playlist.contentTruncated === !playlist.contentComplete,
    `${playlist.slug} has invalid YouTube completeness metadata`
  );
}

function toYouTubeIndexCard(playlist) {
  return {
    provider: playlist.provider,
    slug: playlist.slug,
    title: playlist.title,
    category: playlist.category,
    interests: playlist.interests,
    regions: playlist.regions,
    coverImage: playlist.coverImage,
    youtubePlaylistId: playlist.youtubePlaylistId,
    youtubeUrl: playlist.youtubeUrl,
    youtubeMusicUrl: playlist.youtubeMusicUrl,
    embedUrl: playlist.embedUrl,
    snapshotId: playlist.snapshotId,
    fetchMode: playlist.fetchMode,
    contentMode: playlist.contentMode,
    contentComplete: playlist.contentComplete,
    contentTruncated: playlist.contentTruncated,
    tracksAvailable: playlist.tracksAvailable,
    trackCount: playlist.trackCount,
    youtubeItemTotal: playlist.youtubeItemTotal,
    updatedAt: playlist.updatedAt,
    stale: Boolean(playlist.stale)
  };
}

function youtubePlaylistUrl(playlistId, music = false) {
  return `https://${music ? "music." : "www."}youtube.com/playlist?list=${playlistId}`;
}

function textValue(value) {
  return value?.simpleText || value?.runs?.map((run) => run.text || "").join("") || null;
}

function numberFromText(value) {
  const match = String(value || "").match(/\d[\d,]*/);
  return match ? Number(match[0].replaceAll(",", "")) : null;
}

function durationTextToMs(value) {
  if (!value) return null;
  return value.split(":").reduce((total, part) => total * 60 + Number(part), 0) * 1000;
}

function bestYouTubeThumbnail(thumbnails) {
  const items = Array.isArray(thumbnails) ? [...thumbnails] : Object.values(thumbnails || {});
  return items
    .filter((item) => item?.url)
    .sort((left, right) => (left.width || 0) - (right.width || 0))
    .at(-1)?.url || null;
}

async function buildPublicPlaylist(source, previous, generatedAt) {
  const [oembedRaw, pageMeta, tracks] = await Promise.all([
    fetchOEmbed(source.playlistId),
    fetchPageMetadata(source.playlistId),
    fetchEmbedTracks(source.playlistId)
  ]);
  const oembed = { ...pageMeta, ...oembedRaw };
  const spotifyUrl = `https://open.spotify.com/playlist/${source.playlistId}`;
  const title = oembed?.title || source.title;
  const coverImage = oembed?.thumbnail_url || null;
  const snapshotId = `public:${hashJson({
    playlistId: source.playlistId,
    title,
    coverImage,
    tracks: tracks.map((track) => track.spotifyId || `${track.title}:${track.artistNames.join(",")}`)
  })}`;

  return {
    schemaVersion: 1,
    slug: source.slug,
    title,
    category: source.category,
    interests: source.interests,
    regions: source.regions,
    spotifyId: source.playlistId,
    spotifyUrl,
    description: "",
    owner: {
      id: null,
      name: oembed?.author_name || "Spotify",
      spotifyUrl: null
    },
    coverImage,
    embedUrl: oembed?.iframe_url || spotifyEmbedSrc(source.playlistId),
    snapshotId,
    fetchMode: "public",
    contentMode: "embed",
    market: MARKET,
    tracksAvailable: tracks.length > 0,
    trackCount: tracks.length || null,
    spotifyTrackTotal: tracks.length || null,
    updatedAt: previous?.snapshotId === snapshotId && sameTaxonomy(previous, source)
      ? previous.updatedAt
      : generatedAt,
    tracks
  };
}

async function fetchJson(url) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) throw new Error(`JSON fetch failed: ${res.status} ${await res.text()}`);
      return res.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(500 * (2 ** attempt) + Math.floor(Math.random() * 250));
    }
  }
  throw lastError;
}

async function fetchText(url, accept) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: accept || "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9"
        },
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) throw new Error(`Text fetch failed: ${res.status} ${await res.text()}`);
      return res.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(500 * (2 ** attempt) + Math.floor(Math.random() * 250));
    }
  }
  throw lastError;
}

function extractAppleRoomTracks(html) {
  const byKey = new Map();
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRe.exec(html)) !== null) {
    const body = decodeHtml(scriptMatch[1]);
    if (!body.includes("contentDescriptor") || !body.includes("apple.com/us/")) continue;
    try {
      collectAppleRoomTracks(JSON.parse(body), byKey);
    } catch {
      // Not a JSON data script.
    }
  }
  for (const item of extractAppleProductLockups(html)) {
    byKey.set(`${item.title.toLowerCase()}|${item.artistNames.join(",").toLowerCase()}`, item);
  }
  return Array.from(byKey.values()).map((track, index) => ({ ...track, position: index + 1 }));
}

function collectAppleRoomTracks(node, byKey) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectAppleRoomTracks(item, byKey);
    return;
  }

  const item = toAppleRoomTrack(node);
  if (item) byKey.set(`${item.title.toLowerCase()}|${item.artistNames.join(",").toLowerCase()}`, item);

  for (const value of Object.values(node)) collectAppleRoomTracks(value, byKey);
}

function toAppleRoomTrack(node) {
  const descriptor = node.contentDescriptor;
  const kind = descriptor?.kind;
  if (kind !== "song" && kind !== "album") return null;
  const title = typeof node.title === "string" ? node.title.trim() : "";
  const artistNames = appleArtistNames(node);
  if (!title || !artistNames.length) return null;

  const albumTitle = node.tertiaryLinks?.[0]?.title || (kind === "album" ? title : null);
  const appleUrl = descriptor.url || node.segue?.destination?.contentDescriptor?.url || null;
  const albumUrl = node.tertiaryLinks?.[0]?.segue?.destination?.contentDescriptor?.url || appleUrl;
  const id = descriptor.identifiers?.storeAdamID || null;

  return {
    position: 0,
    title,
    artistNames,
    artists: artistNames.map((name) => ({ name, appleUrl: null })),
    album: {
      name: albumTitle,
      releaseDate: null,
      coverImage: appleArtworkUrl(node.artwork?.dictionary?.url),
      appleUrl: albumUrl
    },
    durationMs: Number.isFinite(node.duration) ? node.duration : null,
    explicit: Boolean(node.showExplicitBadge),
    appleUrl,
    appleId: id
  };
}

function appleArtistNames(node) {
  if (typeof node.artistName === "string" && node.artistName.trim()) return [node.artistName.trim()];
  if (Array.isArray(node.subtitleLinks)) {
    return node.subtitleLinks.map((link) => link?.title).filter((name) => typeof name === "string" && name.trim());
  }
  return [];
}

function appleArtworkUrl(value) {
  if (typeof value !== "string" || !value.startsWith("http")) return null;
  return value
    .replace("{w}x{h}{c}.{f}", "600x600bb.jpg")
    .replace("{w}x{h}", "600x600")
    .replace("{c}", "")
    .replace("{f}", "jpg");
}

function appleHighResolutionArtworkUrl(value) {
  if (typeof value !== "string" || !value.startsWith("http")) return null;
  return value
    .replace("{w}x{h}{c}.{f}", "1200x1200bb.jpg")
    .replace("{w}x{h}", "1200x1200")
    .replace(/\/\d+x\d+(?:bb|SC\.[A-Z0-9]+)\.(?:jpe?g|png|webp)(?=\?|$)/i, "/1200x1200bb.jpg")
    .replace("{c}", "")
    .replace("{f}", "jpg");
}

function extractAppleProductLockups(html) {
  const items = [];
  const seen = new Set();
  const addItem = (item, sourceIndex) => {
    const key = item.appleUrl || `${item.title}|${item.artistNames.join(",")}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ ...item, sourceIndex });
  };
  const blockRe = /<div class="product-lockup[\s\S]*?<\/li>/gi;
  let match;
  while ((match = blockRe.exec(html)) !== null) {
    const block = match[0];
    const titleMatch =
      /data-testid="product-lockup-title"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block) ||
      /data-testid="product-lockup-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!titleMatch) continue;

    const appleUrl = decodeHtml(titleMatch[1]);
    const title = decodeHtml(stripHtml(titleMatch[2]));
    const artistNames = Array.from(block.matchAll(/data-testid="product-lockup-subtitle"[^>]*>([\s\S]*?)<\/a>/gi))
      .map((artist) => decodeHtml(stripHtml(artist[1])))
      .filter(Boolean);
    const ariaSubtitle = productLockupAriaSubtitle(block, title);
    const names = artistNames.length ? artistNames : ariaSubtitle ? [ariaSubtitle] : [];
    if (!title || !names.length) continue;

    addItem({
      position: 0,
      title,
      artistNames: names,
      artists: names.map((name) => ({ name, appleUrl: null })),
      album: {
        name: title,
        releaseDate: null,
        coverImage: appleStaticArtworkUrl(block),
        appleUrl
      },
      durationMs: null,
      explicit: /data-testid="explicit-badge"/i.test(block),
      appleUrl,
      appleId: appleUrl.split("/").pop()?.split("?")[0] || null
    }, match.index);
  }
  const linkRe = /data-testid="product-lockup-link"[^>]*aria-label="([^"]*)"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = linkRe.exec(html)) !== null) {
    const title = decodeHtml(stripHtml(match[3]));
    const appleUrl = decodeHtml(match[2]);
    const ariaSubtitle = productLockupAriaSubtitle(match[0], title) || decodeHtml(match[1]).split(",").slice(1).join(",").trim();
    const start = Math.max(0, html.lastIndexOf("<div class=\"product-lockup", match.index));
    const block = html.slice(start, match.index + match[0].length);
    if (!title || !appleUrl || !ariaSubtitle) continue;
    addItem({
      position: 0,
      title,
      artistNames: [ariaSubtitle],
      artists: [{ name: ariaSubtitle, appleUrl: null }],
      album: {
        name: title,
        releaseDate: null,
        coverImage: appleStaticArtworkUrl(block),
        appleUrl
      },
      durationMs: null,
      explicit: /data-testid="explicit-badge"/i.test(block),
      appleUrl,
      appleId: appleUrl.split("/").pop()?.split("?")[0] || null
    }, match.index);
  }
  return items
    .sort((left, right) => left.sourceIndex - right.sourceIndex)
    .map(({ sourceIndex, ...item }) => item);
}

function productLockupAriaSubtitle(block, title) {
  const aria = decodeHtml(/aria-label="([^"]+)"/i.exec(block)?.[1] || "");
  if (!aria.startsWith(title)) return "";
  return aria.slice(title.length).replace(/^,\s*/, "").trim();
}

function extractAppleEditorialItems(html, parentSlug) {
  return extractAppleProductLockups(html).map((item, index) => ({
    position: index + 1,
    title: item.title,
    subtitle: item.artistNames.join(", "),
    artistNames: item.artistNames,
    kind: item.appleUrl?.includes("/playlist/") ? "playlist" : item.appleUrl?.includes("/album/") ? "album" : "editorial",
    coverImage: item.album?.coverImage || null,
    appleUrl: item.appleUrl,
    appleId: item.appleId,
    detailSource: `data/apple-editorial/${parentSlug}/${editorialDetailSlug(item)}.json`,
    trackCount: 0,
    explicit: Boolean(item.explicit)
  }));
}

function extractAppleSongTracks(html, fallbackCoverImage) {
  const byKey = new Map();
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRe.exec(html)) !== null) {
    const body = decodeHtml(scriptMatch[1]);
    if (!body.includes("contentDescriptor") || !body.includes("apple.com/us/")) continue;
    try {
      collectAppleSongTracks(JSON.parse(body), byKey, fallbackCoverImage);
    } catch {
      // Not a JSON data script.
    }
  }
  return Array.from(byKey.values()).map((track, index) => ({ ...track, position: index + 1 }));
}

function collectAppleSongTracks(node, byKey, fallbackCoverImage) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectAppleSongTracks(item, byKey, fallbackCoverImage);
    return;
  }

  const item = toAppleSongTrack(node, fallbackCoverImage);
  if (item) byKey.set(`${item.title.toLowerCase()}|${item.artistNames.join(",").toLowerCase()}`, item);
  for (const value of Object.values(node)) collectAppleSongTracks(value, byKey, fallbackCoverImage);
}

function toAppleSongTrack(node, fallbackCoverImage) {
  const descriptor = node.contentDescriptor;
  if (descriptor?.kind !== "song" && descriptor?.kind !== "musicVideo") return null;
  const title = typeof node.title === "string" ? node.title.trim() : "";
  const artistNames = appleArtistNames(node);
  if (!title || !artistNames.length) return null;
  const appleUrl = descriptor.url || node.segue?.destination?.contentDescriptor?.url || null;
  return {
    position: 0,
    title,
    artistNames,
    artists: artistNames.map((name) => ({ name, appleUrl: null })),
    album: {
      name: node.tertiaryLinks?.[0]?.title || null,
      releaseDate: null,
      coverImage: appleArtworkUrl(node.artwork?.dictionary?.url) || fallbackCoverImage || null,
      appleUrl: node.tertiaryLinks?.[0]?.segue?.destination?.contentDescriptor?.url || appleUrl
    },
    durationMs: Number.isFinite(node.duration) ? node.duration : null,
    explicit: Boolean(node.showExplicitBadge),
    appleUrl,
    appleId: descriptor.identifiers?.storeAdamID || null
  };
}

function editorialDetailSlug(item) {
  const id = String(item.appleId || item.appleUrl?.split("/").pop() || item.title || "item")
    .split("?")[0]
    .replace(/[^a-zA-Z0-9._-]/g, "-");
  return id || hashJson(item.appleUrl || item.title).slice(0, 12);
}

function appleStaticArtworkUrl(block) {
  const url = /https:\/\/is\d-ssl\.mzstatic\.com\/image\/thumb\/[^"',\s]+/i.exec(block)?.[0];
  if (!url) return null;
  return decodeHtml(url).replace(/\/\d+x\d+[^/]*\.(?:webp|jpg|png)$/i, "/600x600bb.jpg");
}

async function fetchOEmbed(playlistId) {
  const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
  const endpoints = [
    `https://open.spotify.com/oembed?url=${encodeURIComponent(playlistUrl)}`,
    `https://open.spotify.com/v1/oembed?url=${encodeURIComponent(playlistUrl)}`,
    `https://noembed.com/embed?url=${encodeURIComponent(playlistUrl)}`
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.title || data?.thumbnail_url) return data;
    } catch {
      // Try the next public endpoint.
    }
  }
  return null;
}

async function fetchPageMetadata(playlistId) {
  try {
    const res = await fetch(`https://open.spotify.com/playlist/${playlistId}`, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    return {
      title: htmlMeta(html, "og:title") || htmlTitle(html),
      thumbnail_url: htmlMeta(html, "og:image")
    };
  } catch {
    return null;
  }
}

async function fetchEmbedTracks(playlistId) {
  try {
    const res = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return [];
    const html = await res.text();
    const nextData = extractScriptJson(html, "__NEXT_DATA__");
    if (nextData) {
      const found = deepFindTracks(nextData);
      if (found.length) return found;
    }

    const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRe.exec(html)) !== null) {
      const body = match[1];
      if (!body.includes("spotify:track") && !body.includes('"trackList"')) continue;
      try {
        const found = deepFindTracks(JSON.parse(body));
        if (found.length) return found;
      } catch {
        // Not JSON; keep scanning.
      }
    }
  } catch {
    // Public Spotify pages sometimes block server fetches. Empty tracks still
    // leaves PulseDeck with usable cards, cover, and Spotify links.
  }
  return [];
}

function extractScriptJson(html, id) {
  const match = html.match(new RegExp(`<script[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)</script>`, "i"));
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function deepFindTracks(obj) {
  const stack = [obj];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;

    if (Array.isArray(node)) {
      const tracks = node.map(normalizePublicTrack).filter(Boolean);
      if (tracks.length) return tracks.map((track, index) => ({ ...track, position: index + 1 }));
      stack.push(...node);
      continue;
    }

    for (const value of Object.values(node)) stack.push(value);
  }
  return [];
}

function normalizePublicTrack(item) {
  if (!item || typeof item !== "object") return null;
  const obj = item.track && typeof item.track === "object" ? item.track : item;
  const title = typeof obj.name === "string" ? obj.name : typeof obj.title === "string" ? obj.title : null;
  if (!title) return null;
  if (!("artists" in obj || "subtitle" in obj || "uri" in obj)) return null;

  const artists = Array.isArray(obj.artists)
    ? obj.artists
        .map((artist) => (typeof artist === "string" ? { name: artist } : artist))
        .filter((artist) => artist?.name)
    : typeof obj.subtitle === "string"
      ? obj.subtitle.split(/,\s*|\u00a0/).map((name) => ({ name: name.trim() })).filter((artist) => artist.name)
    : [];
  const album = obj.album && typeof obj.album === "object" ? obj.album : {};
  const uri = typeof obj.uri === "string" ? obj.uri : null;

  return {
    position: 0,
    addedAt: null,
    spotifyId: typeof obj.id === "string" ? obj.id : uri?.split(":").pop() || null,
    title,
    artistNames: artists.map((artist) => artist.name),
    artists: artists.map((artist) => ({
      id: artist.id || null,
      name: artist.name,
      spotifyUrl: artist.external_urls?.spotify || null
    })),
    album: {
      id: album.id || null,
      name: album.name || null,
      releaseDate: album.release_date || null,
      coverImage: firstImage(album.images),
      spotifyUrl: album.external_urls?.spotify || null
    },
    durationMs: obj.durationMs ?? obj.duration_ms ?? obj.duration ?? null,
    explicit: Boolean(obj.explicit ?? obj.isExplicit),
    previewUrl: obj.preview_url || obj.audioPreview?.url || null,
    uri,
    spotifyUrl: obj.external_urls?.spotify || null
  };
}

function toIndexCard(playlist) {
  return {
    slug: playlist.slug,
    title: playlist.title,
    category: playlist.category,
    interests: playlist.interests,
    regions: playlist.regions,
    coverImage: playlist.coverImage,
    embedUrl: playlist.embedUrl,
    spotifyUrl: playlist.spotifyUrl,
    snapshotId: playlist.snapshotId,
    fetchMode: playlist.fetchMode,
    contentMode: playlist.contentMode,
    tracksAvailable: playlist.tracksAvailable,
    trackCount: playlist.trackCount,
    updatedAt: playlist.updatedAt,
    stale: Boolean(playlist.stale)
  };
}

function inferAppleInterests(title) {
  const normalized = String(title || "").toLowerCase();
  const interests = APPLE_INTEREST_RULES
    .filter(([, pattern]) => pattern.test(normalized))
    .map(([interest]) => interest);
  return interests.length ? interests : ["popular"];
}

function sameTaxonomy(playlist, source) {
  return sameStringArray(playlist?.interests, source.interests) &&
    sameStringArray(playlist?.regions, source.regions) &&
    playlist?.category === source.category;
}

function sameStringArray(left, right) {
  return Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function toIsoDateOrFallback(value, fallback) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? fallback : new Date(timestamp).toISOString();
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

function spotifyEmbedSrc(playlistId) {
  return `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=pulsedeck`;
}

function htmlMeta(html, property) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i");
  return decodeHtml(re.exec(html)?.[1] || "");
}

function htmlTitle(html) {
  return decodeHtml(/<title>([^<]+)<\/title>/i.exec(html)?.[1] || "");
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashJson(value) {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
