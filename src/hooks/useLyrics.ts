import { useState, useEffect, useMemo } from "react";

export interface LyricLine {
	timeMs: number;
	text: string;
}

export interface ParsedTrack {
	trackName: string;
	artistName: string;
}

/**
 * Checks if the media is likely a standard video (podcast, gameplay, tutorial, news, etc.)
 * or web content (Instagram reels, TikTok, Shorts, Twitter, browser tabs)
 * rather than a song, so we don't display music lyric prompts or search LRCLIB for fake lyrics.
 */
export function isLikelyNonMusicVideo(
	rawTitle: string,
	rawArtist: string,
	durationMs?: number
): boolean {
	if (!rawTitle) return true;

	// Videos longer than 20 minutes (1,200,000 ms) are almost never standalone songs
	if (durationMs && durationMs > 1200000) {
		return true;
	}

	const titleTrimmed = rawTitle.trim();
	const titleLower = titleTrimmed.toLowerCase();
	const artistLower = (rawArtist || "").trim().toLowerCase();
	const combined = `${titleLower} ${artistLower}`;

	// Exact or standalone web / browser / social media titles
	const bannedStandalone = [
		"instagram",
		"reels",
		"reel",
		"tiktok",
		"youtube shorts",
		"shorts",
		"facebook",
		"twitter",
		"x.com",
		"reddit",
		"twitch",
		"brave",
		"chrome",
		"msedge",
		"edge",
		"firefox",
		"opera",
		"netflix",
		"crunchyroll",
		"new tab",
		"bloom media"
	];

	if (bannedStandalone.includes(titleLower)) {
		return true;
	}

	// Starts with or contains prominent social media / video platform indicators
	if (
		/^instagram(\.com)?\b/i.test(titleLower) ||
		/^reels?\b/i.test(titleLower) ||
		/^tiktok\b/i.test(titleLower) ||
		/^youtube shorts\b/i.test(titleLower) ||
		/\b(instagram reel|tiktok video|youtube short)\b/i.test(titleLower)
	) {
		return true;
	}

	// Browser / web URLs in title
	if (/https?:\/\/|\.com\/|\.org\/|\.net\/|www\./i.test(titleLower)) {
		return true;
	}

	const nonMusicPatterns = [
		/\binstagram\b/i,
		/\breels?\b/i,
		/\btiktok\b/i,
		/\bshorts\b/i,
		/\btutorial(?:es)?\b/i,
		/\bgameplay(?:s)?\b/i,
		/\bwalkthrough\b/i,
		/\bpodcast(?:s)?\b/i,
		/\bnoticias?\b/i,
		/\bnoticiero\b/i,
		/\breview(?:s)?\b/i,
		/\bunboxing\b/i,
		/\bcap[ií]tulo(?:\s*\d+)?\b/i,
		/\bepisodio(?:\s*\d+)?\b/i,
		/\bepisode(?:\s*\d+)?\b/i,
		/\blive\s*stream\b/i,
		/\bdirecto\b/i,
		/\bcurso(?:s)?\b/i,
		/\baprende\b/i,
		/\bc[oó]mo\s*(?:hacer|usar|crear|instalar|programar)\b/i,
		/\bhow\s*to\b/i,
		/\bvlog(?:s)?\b/i,
		/\breacci[oó]n(?:es)?\b/i,
		/\breacting\s*to\b/i,
		/\btrailer\b/i,
		/\bteaser\b/i,
		/\bdocumental\b/i,
		/\bdocumentary\b/i,
		/\bgu[ií]a\s*(?:completa|b[aá]sica)?\b/i,
		/\bresumen\s*(?:de|del)?\b/i,
		/\bminecraft\b/i,
		/\bfortnite\b/i,
		/\broblox\b/i,
		/\bvalorant\b/i,
		/\bgta\s*(?:v|5|vi|online)?\b/i,
		/\bleague\s*of\s*legends\b/i
	];

	return nonMusicPatterns.some((pattern) => pattern.test(combined));
}

/**
 * Robust track & artist extraction designed for YouTube, Spotify, and browser SMTC titles.
 * Handles prefixes, bracketed tags, translation notes, pipe separators, and hyphens.
 */
export function parseTrackAndArtist(rawTitle: string, rawArtist: string): ParsedTrack[] {
	const candidates: ParsedTrack[] = [];
	if (!rawTitle) return candidates;

	// 1. Remove leading punctuation, bullets, track numbers (e.g. "- ", "01. ", "• ")
	let cleaned = rawTitle
		.replace(/^[\s\-_–—|:;•·\d.]+/g, "")
		.trim();

	// 2. Strip bracketed video metadata: [Official Video], (En Español), (Su Español), (Lyrics), (Visualizer), etc.
	const videoTagsRegex =
		/[\(\[\{](?:official\s*(?:music\s*)?video|video\s*oficial|audio\s*oficial|official\s*audio|visualizer|lyric\s*video|lyrics|letra(?:\s*completa)?|4k|hd|remastered|live|en\s*vivo|audio|full\s*album|sub(?:titulado)?(?:\s*al)?(?:\s*español|\s*ingles)?|(?:su|en)\s*español|traducci[oó]n|traducida|videoclip(?:\s*oficial)?|cover|karaoke|acoustic|ac[uú]stico|prod(?:\.|\s*by)?[^\)\]\}]*)[\)\]\}]/gi;
	cleaned = cleaned.replace(videoTagsRegex, "").trim();

	// Remove trailing language / subtitle parentheticals (e.g. "(Su Español)")
	cleaned = cleaned
		.replace(/\s*\([^)]*(?:español|sub|letra|lyrics|video|audio)[^)]*\)$/gi, "")
		.replace(/\s*\[[^\]]*(?:español|sub|letra|lyrics|video|audio)[^\]]*\]$/gi, "")
		.trim();

	// 3. Clean artist string
	const cleanArtist = (rawArtist || "")
		.replace(/^[\s\-_–—|:;•·]+/g, "")
		.replace(/[\(\[\{]\s*(?:ft\.?|feat\.?)[^\)\]\}]*[\)\]\}]/gi, "")
		.replace(/,\s*(?:ft\.?|feat\.?).*$/gi, "")
		.replace(/\s*-\s*topic$/gi, "") // YouTube "- Topic" channels
		.replace(/\s{2,}/g, " ")
		.trim();

	// 4. Handle pipe separators e.g. "- California | Ciclope (Su Español)" -> "California" | "Ciclope"
	const pipeParts = cleaned.split(/\s*\|\s*/);
	if (pipeParts.length > 1) {
		const part0 = pipeParts[0].trim();
		const part1 = pipeParts[1].trim();
		if (part0) {
			candidates.push({ trackName: part0, artistName: part1 });
			candidates.push({ trackName: part0, artistName: cleanArtist });
			candidates.push({ trackName: part0, artistName: "" });
		}
		if (part1) {
			candidates.push({ trackName: part1, artistName: part0 });
		}
	}

	// 5. Check for "Artist - Title" format (common on YouTube / browser)
	const hyphenMatch = cleaned.match(/^(.*?)\s*[-–—]\s*(.*)$/);
	if (hyphenMatch) {
		const left = hyphenMatch[1]
			.replace(/[\(\[\{]\s*(?:ft\.?|feat\.?)[^\)\]\}]*[\)\]\}]/gi, "")
			.replace(/\s*(?:ft\.?|feat\.?).*$/gi, "")
			.trim();
		const right = hyphenMatch[2]
			.replace(/[\(\[\{]\s*(?:ft\.?|feat\.?)[^\)\]\}]*[\)\]\}]/gi, "")
			.trim();
		if (left && right) {
			// Candidate: left is artist, right is track
			candidates.push({ artistName: left, trackName: right });
			// Candidate: right is artist, left is track
			candidates.push({ artistName: right, trackName: left });
		}
	}

	// 6. Direct track without artist / fallback
	const pureTrack = cleaned
		.replace(/[\(\[\{]\s*(?:ft\.?|feat\.?)[^\)\]\}]*[\)\]\}]/gi, "")
		.replace(/\s*(?:ft\.?|feat\.?).*$/gi, "")
		.replace(/\s{2,}/g, " ")
		.trim();
	if (pureTrack) {
		if (cleanArtist) {
			candidates.push({ trackName: pureTrack, artistName: cleanArtist });
		}
		candidates.push({ trackName: pureTrack, artistName: "" });
	}

	// Deduplicate candidates and reject non-music / web candidates
	const seen = new Set<string>();
	const bannedKeywords = new Set([
		"instagram",
		"reels",
		"reel",
		"tiktok",
		"shorts",
		"brave",
		"chrome",
		"edge",
		"msedge",
		"firefox",
		"opera",
		"bloom media"
	]);

	return candidates.filter((c) => {
		const trackLower = c.trackName.toLowerCase().trim();
		if (!trackLower || bannedKeywords.has(trackLower)) return false;
		if (isLikelyNonMusicVideo(c.trackName, c.artistName)) return false;

		const k = `${trackLower}|||${c.artistName.toLowerCase().trim()}`;
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
}

export function cleanSongTitle(raw: string): string {
	if (!raw) return "";
	return raw
		.replace(/^[\s\-_–—|:;•·\d.]+/g, "")
		.replace(
			/[\(\[\{](?:official\s*(?:music\s*)?video|video\s*oficial|audio\s*oficial|official\s*audio|visualizer|lyric\s*video|lyrics|letra(?:\s*completa)?|4k|hd|remastered|live|en\s*vivo|audio|(?:su|en)\s*español)[\)\]\}]/gi,
			""
		)
		.replace(/[\(\[\{]\s*(?:ft\.?|feat\.?)[^\)\]\}]*[\)\]\}]/gi, "")
		.replace(/\s*-\s*(?:official|video\s*oficial|audio).*$/gi, "")
		.replace(/\s{2,}/g, " ")
		.trim();
}

function parseLrc(lrcText: string): LyricLine[] {
	if (!lrcText) return [];
	const lines = lrcText.split("\n");
	const result: LyricLine[] = [];

	const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		let match: RegExpExecArray | null;
		const timestamps: number[] = [];
		let lastIndex = 0;

		timeRegex.lastIndex = 0;
		while ((match = timeRegex.exec(trimmed)) !== null) {
			const min = parseInt(match[1], 10);
			const sec = parseInt(match[2], 10);
			const msPart = match[3] || "0";
			const ms = msPart.length === 2 ? parseInt(msPart, 10) * 10 : parseInt(msPart, 10);
			timestamps.push(min * 60 * 1000 + sec * 1000 + ms);
			lastIndex = timeRegex.lastIndex;
		}

		const text = trimmed.substring(lastIndex).trim();
		if (text) {
			for (const t of timestamps) {
				result.push({ timeMs: t, text });
			}
		}
	}

	return result.sort((a, b) => a.timeMs - b.timeMs);
}

function parsePlainLyrics(plainText: string): LyricLine[] {
	if (!plainText) return [];
	return plainText
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0)
		.map((text, idx) => ({
			timeMs: idx * 3500,
			text
		}));
}

// Persistent memory + localStorage cache across song changes and app reloads
const STORAGE_KEY = "bloom-lyrics-cache-v1";
const lyricsCache = new Map<string, LyricLine[]>();

// Hydrate from localStorage once on boot
try {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (raw) {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === "object") {
			for (const [k, v] of Object.entries(parsed)) {
				if (Array.isArray(v) && v.length > 0) {
					lyricsCache.set(k, v as LyricLine[]);
				}
			}
		}
	}
} catch {}

function setCachedLyrics(key: string, lines: LyricLine[]) {
	lyricsCache.set(key, lines);
	if (lines.length > 0) {
		try {
			const list = Array.from(lyricsCache.entries()).slice(-60);
			const data: Record<string, LyricLine[]> = {};
			for (const [k, v] of list) {
				if (v.length > 0) data[k] = v;
			}
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		} catch {}
	}
}

export function useLyrics(
	rawTitle: string,
	rawArtist: string,
	currentPositionMs: number,
	_isPlaying: boolean,
	durationMs?: number
) {
	const [lyrics, setLyrics] = useState<LyricLine[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [lyricsEnabled, setLyricsEnabled] = useState(() => {
		return localStorage.getItem("bloom-lyrics-enabled") !== "false";
	});

	const isNonMusicVideo = useMemo(
		() => isLikelyNonMusicVideo(rawTitle, rawArtist, durationMs),
		[rawTitle, rawArtist, durationMs]
	);

	const cleanedTitle = useMemo(() => cleanSongTitle(rawTitle), [rawTitle]);
	const cacheKey = `${(rawTitle || "").toLowerCase()}---${(rawArtist || "").toLowerCase()}`;

	useEffect(() => {
		if (!rawTitle || isNonMusicVideo) {
			setLyrics([]);
			setIsLoading(false);
			return;
		}

		if (lyricsCache.has(cacheKey)) {
			setLyrics(lyricsCache.get(cacheKey) || []);
			return;
		}

		let isCancelled = false;
		setIsLoading(true);

		const fetchLyrics = async () => {
			try {
				const candidates = parseTrackAndArtist(rawTitle, rawArtist);

				// 1. Try direct /api/get for each candidate (fast & highly reliable)
				for (const cand of candidates) {
					if (!cand.trackName) continue;
					try {
						const getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(
							cand.artistName
						)}&track_name=${encodeURIComponent(cand.trackName)}`;
						const res = await fetch(getUrl, {
							headers: { "User-Agent": "Bloom/3.10.0 (https://github.com/bloom)" }
						});
						if (res.ok) {
							const data = await res.json();
							if (data?.syncedLyrics) {
								const parsed = parseLrc(data.syncedLyrics);
								if (parsed.length > 0 && !isCancelled) {
									setCachedLyrics(cacheKey, parsed);
									setLyrics(parsed);
									setIsLoading(false);
									return;
								}
							} else if (data?.plainLyrics) {
								const parsed = parsePlainLyrics(data.plainLyrics);
								if (parsed.length > 0 && !isCancelled) {
									setCachedLyrics(cacheKey, parsed);
									setLyrics(parsed);
									setIsLoading(false);
									return;
								}
							}
						}
					} catch {}
				}

				// 2. Search by query with track and artist
				const searchCandidates = candidates.slice(0, 3);
				for (const cand of searchCandidates) {
					if (!cand.trackName) continue;
					try {
						const query = `${cand.trackName} ${cand.artistName}`.trim();
						const searchRes = await fetch(
							`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`,
							{ headers: { "User-Agent": "Bloom/3.10.0 (https://github.com/bloom)" } }
						);
						if (searchRes.ok) {
							const items: any[] = await searchRes.json();
							if (Array.isArray(items)) {
								// Find item that actually matches the candidate artist
								const targetArtist = (cand.artistName || "").toLowerCase().trim();
								const targetTrack = cand.trackName.toLowerCase().trim();
								const match = items.find((item) => {
									if (!item.syncedLyrics && !item.plainLyrics) return false;
									const itemArtist = (item.artistName || "").toLowerCase().trim();
									const itemTrack = (item.trackName || "").toLowerCase().trim();

									// If candidate specified an artist, strictly ensure artist matches or contains words
									if (targetArtist) {
										const artistMatch =
											itemArtist.includes(targetArtist) ||
											targetArtist.includes(itemArtist) ||
											itemArtist.split(/\s+/).some((w: string) => w.length > 2 && targetArtist.includes(w));
										if (!artistMatch) return false;
									}

									// Ensure track title has high similarity
									const trackMatch =
										itemTrack.includes(targetTrack) ||
										targetTrack.includes(itemTrack) ||
										itemTrack.split(/\s+/).some((w: string) => w.length > 2 && targetTrack.includes(w));
									if (!trackMatch) return false;

									// Optional duration validation (within 15 seconds) if available
									if (durationMs && item.duration) {
										const diff = Math.abs(item.duration * 1000 - durationMs);
										if (diff > 15000) return false;
									}

									return true;
								});

								if (match && !isCancelled) {
									const parsed = match.syncedLyrics
										? parseLrc(match.syncedLyrics)
										: parsePlainLyrics(match.plainLyrics);
									if (parsed.length > 0) {
										setCachedLyrics(cacheKey, parsed);
										setLyrics(parsed);
										setIsLoading(false);
										return;
									}
								}
							}
						}
					} catch {}
				}

				// 3. Fallback: search by track_name only, BUT STILL REQUIRE ARTIST MATCH if artist was provided
				for (const cand of searchCandidates) {
					if (!cand.trackName) continue;
					try {
						const fallbackRes = await fetch(
							`https://lrclib.net/api/search?track_name=${encodeURIComponent(cand.trackName)}`,
							{ headers: { "User-Agent": "Bloom/3.10.0 (https://github.com/bloom)" } }
						);
						if (fallbackRes.ok) {
							const fallbackItems: any[] = await fallbackRes.json();
							if (Array.isArray(fallbackItems)) {
								const targetArtist = (cand.artistName || "").toLowerCase().trim();
								const targetTrack = cand.trackName.toLowerCase().trim();
								const match = fallbackItems.find((item) => {
									if (!item.syncedLyrics && !item.plainLyrics) return false;
									const itemArtist = (item.artistName || "").toLowerCase().trim();
									const itemTrack = (item.trackName || "").toLowerCase().trim();

									// If artist was provided, do NOT accept random artists!
									if (targetArtist) {
										const artistMatch =
											itemArtist.includes(targetArtist) ||
											targetArtist.includes(itemArtist) ||
											itemArtist.split(/\s+/).some((w: string) => w.length > 2 && targetArtist.includes(w));
										if (!artistMatch) return false;
									} else {
										// If no artist was provided, track name must match exactly
										if (itemTrack !== targetTrack) return false;
									}

									// Duration check if available
									if (durationMs && item.duration) {
										const diff = Math.abs(item.duration * 1000 - durationMs);
										if (diff > 15000) return false;
									}

									return true;
								});

								if (match && !isCancelled) {
									const parsed = match.syncedLyrics
										? parseLrc(match.syncedLyrics)
										: parsePlainLyrics(match.plainLyrics);
									if (parsed.length > 0) {
										setCachedLyrics(cacheKey, parsed);
										setLyrics(parsed);
										setIsLoading(false);
										return;
									}
								}
							}
						}
					} catch {}
				}

				if (!isCancelled) {
					lyricsCache.set(cacheKey, []);
					setLyrics([]);
				}
			} catch (err) {
				console.warn("Failed to fetch lyrics:", err);
				if (!isCancelled) setLyrics([]);
			} finally {
				if (!isCancelled) setIsLoading(false);
			}
		};

		fetchLyrics();

		return () => {
			isCancelled = true;
		};
	}, [rawTitle, rawArtist, cleanedTitle, cacheKey, isNonMusicVideo]);

	// Calculate active line based on current position
	const { activeIndex, currentLine, prevLine, nextLine } = useMemo(() => {
		if (!lyrics.length || isNonMusicVideo) {
			return { activeIndex: -1, currentLine: null, prevLine: null, nextLine: null };
		}

		// Find the last line whose timeMs <= currentPositionMs
		let idx = -1;
		for (let i = 0; i < lyrics.length; i++) {
			if (lyrics[i].timeMs <= currentPositionMs) {
				idx = i;
			} else {
				break;
			}
		}

		// If before first lyric (intro), currentLine is null (not "Instrumental")
		const prev = idx > 0 ? lyrics[idx - 1].text : null;
		const curr = idx >= 0 ? lyrics[idx].text : null;
		const next = idx + 1 < lyrics.length ? lyrics[idx + 1].text : null;

		return { activeIndex: idx, currentLine: curr, prevLine: prev, nextLine: next };
	}, [lyrics, currentPositionMs, isNonMusicVideo]);

	return {
		lyrics,
		activeIndex,
		currentLine,
		prevLine,
		nextLine,
		hasLyrics: lyrics.length > 0 && !isNonMusicVideo,
		isLoading,
		isNonMusicVideo,
		lyricsEnabled,
		toggleLyrics: () => {
			setLyricsEnabled((prev) => {
				const next = !prev;
				localStorage.setItem("bloom-lyrics-enabled", String(next));
				return next;
			});
		}
	};
}
