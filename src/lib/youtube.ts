import { YoutubeTranscript } from 'youtube-transcript';

/**
 * YouTube Data API v3 helpers for the CASE 2 recipe pipeline.
 * Search is free (quota-bound), transcripts are free — only the final
 * gpt-4o-mini extraction costs money (~₹0.5 vs ~₹4 full generation).
 *
 * All functions return null on ANY failure (quota exhaustion, network,
 * consent walls) — the caller falls back to plain GPT generation.
 */

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelName: string;
  url: string;
  viewCount: number;
}

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';
const MIN_VIEW_COUNT = 10000;

interface YTSearchItem {
  id?: { videoId?: string };
  snippet?: { title?: string; channelTitle?: string };
}

interface YTVideoStatsItem {
  id?: string;
  statistics?: { viewCount?: string };
}

/**
 * Searches YouTube for a homemade Hindi recipe video for the given dish.
 * Medium duration (4–20 min) excludes Shorts; results filtered to >10k views.
 * Returns the most-viewed candidate, or null on any failure.
 */
export async function searchYouTubeRecipe(
  dishName: string,
): Promise<YouTubeVideo | null> {
  const candidates = await searchYouTubeRecipeCandidates(dishName);
  return candidates[0] ?? null;
}

/**
 * Same search, but returns ALL >10k-view candidates sorted by views — callers
 * (batch seeding) can walk the list when the top video has transcripts disabled.
 */
export async function searchYouTubeRecipeCandidates(
  dishName: string,
): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_DATA_API;
  if (!apiKey || !dishName.trim()) return [];

  try {
    // 1 — search.list: top 5 relevant Hindi recipe videos
    const searchParams = new URLSearchParams({
      part: 'snippet',
      q: `${dishName} recipe ghar jaisa hindi`,
      type: 'video',
      relevanceLanguage: 'hi',
      regionCode: 'IN',
      videoDuration: 'medium',
      order: 'relevance',
      maxResults: '5',
      key: apiKey,
    });
    const searchRes = await fetch(`${YT_API_BASE}/search?${searchParams}`);
    if (!searchRes.ok) {
      console.error('[youtube] search.list failed:', searchRes.status);
      return [];
    }
    const searchJson = (await searchRes.json()) as { items?: YTSearchItem[] };
    const items = (searchJson.items ?? []).filter(
      (it) => it.id?.videoId && it.snippet,
    );
    if (items.length === 0) return [];

    // 2 — videos.list: statistics for the candidate ids
    const ids = items.map((it) => it.id!.videoId!).join(',');
    const statsParams = new URLSearchParams({
      part: 'statistics',
      id: ids,
      key: apiKey,
    });
    const statsRes = await fetch(`${YT_API_BASE}/videos?${statsParams}`);
    if (!statsRes.ok) {
      console.error('[youtube] videos.list failed:', statsRes.status);
      return [];
    }
    const statsJson = (await statsRes.json()) as { items?: YTVideoStatsItem[] };

    // Match stats by video id, NOT by array index
    const viewsById = new Map<string, number>();
    for (const s of statsJson.items ?? []) {
      if (s.id) viewsById.set(s.id, Number(s.statistics?.viewCount ?? 0));
    }

    const candidates: YouTubeVideo[] = items
      .map((it) => {
        const videoId = it.id!.videoId!;
        return {
          videoId,
          title: it.snippet?.title ?? '',
          channelName: it.snippet?.channelTitle ?? '',
          url: `https://www.youtube.com/watch?v=${videoId}`,
          viewCount: viewsById.get(videoId) ?? 0,
        };
      })
      .filter((v) => v.viewCount > MIN_VIEW_COUNT)
      .sort((a, b) => b.viewCount - a.viewCount);

    return candidates;
  } catch (err) {
    console.error(
      '[youtube] searchYouTubeRecipe error:',
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

/**
 * Fetches the transcript for a video — Hindi first, then any language.
 * youtube-transcript can throw on consent/region walls, so everything is
 * caught. Returns the first 4000 chars, or null when nothing is available.
 */
export async function extractTranscript(
  videoId: string,
): Promise<string | null> {
  let segments;
  try {
    segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'hi' });
  } catch {
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (err) {
      console.error(
        '[youtube] extractTranscript failed:',
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }

  if (!segments || segments.length === 0) return null;
  const text = segments
    .map((s) => s.text)
    .join(' ')
    .trim();
  return text.length > 0 ? text.slice(0, 4000) : null;
}
