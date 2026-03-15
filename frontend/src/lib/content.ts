import { IMAGE_TRANSFORM_BASE_URL } from "../config";

const IMAGE_URL_REGEX = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|avif)(?:[?#]\S*)?$/i;
const MARKDOWN_LINK_REGEX = /^\[[^\]]*]\((https?:\/\/\S+)\)$/i;
const AUTOLINK_REGEX = /^<(https?:\/\/\S+)>$/i;
const URL_CANDIDATE_REGEX = /https?:\/\/\S+/gi;

function getYouTubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\/+/, "").split("/")[0] || "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (!host.endsWith("youtube.com")) {
      return null;
    }

    if (parsed.pathname === "/watch") {
      const id = parsed.searchParams.get("v") || "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    const parts = parsed.pathname.replace(/^\/+/, "").split("/");
    if (parts[0] === "embed" || parts[0] === "shorts") {
      const id = parts[1] || "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function isImageLikeUrl(url?: string | null) {
  if (!url) {
    return false;
  }
  return IMAGE_URL_REGEX.test(url.trim());
}

export function getYouTubeEmbedUrl(url?: string | null) {
  if (!url) {
    return null;
  }
  const id = getYouTubeVideoId(url.trim());
  if (!id) {
    return null;
  }
  return `https://www.youtube.com/embed/${id}`;
}

export function isYouTubeUrl(url?: string | null) {
  return Boolean(getYouTubeEmbedUrl(url));
}

function getStandaloneImageUrlFromLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  if (IMAGE_URL_REGEX.test(trimmed)) {
    return trimmed;
  }
  const mdMatch = trimmed.match(MARKDOWN_LINK_REGEX);
  if (mdMatch && isImageLikeUrl(mdMatch[1])) {
    return mdMatch[1];
  }
  const autolinkMatch = trimmed.match(AUTOLINK_REGEX);
  if (autolinkMatch && isImageLikeUrl(autolinkMatch[1])) {
    return autolinkMatch[1];
  }
  return null;
}

export function extractStandaloneImagePreviewUrls(input: string, max = 3) {
  if (!input?.trim()) {
    return [];
  }
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const line of input.split(/\r?\n/)) {
    const url = getStandaloneImageUrlFromLine(line);
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    urls.push(url);
    if (urls.length >= max) {
      break;
    }
  }
  return urls;
}

export function extractFirstYouTubeEmbedUrl(input: string) {
  if (!input?.trim()) {
    return null;
  }

  const lines = input.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const markdownMatch = trimmed.match(MARKDOWN_LINK_REGEX);
    if (markdownMatch) {
      const embed = getYouTubeEmbedUrl(markdownMatch[1]);
      if (embed) {
        return embed;
      }
    }

    const autolinkMatch = trimmed.match(AUTOLINK_REGEX);
    if (autolinkMatch) {
      const embed = getYouTubeEmbedUrl(autolinkMatch[1]);
      if (embed) {
        return embed;
      }
    }

    const candidates = trimmed.match(URL_CANDIDATE_REGEX) || [];
    for (const candidate of candidates) {
      const cleaned = candidate.replace(/[),.!?]+$/, "");
      const embed = getYouTubeEmbedUrl(cleaned);
      if (embed) {
        return embed;
      }
    }
  }

  return null;
}

export function stripLeadingFirstYouTubeUrl(input: string) {
  if (!input?.trim()) {
    return input;
  }

  const urlRegex = /https?:\/\/\S+/gi;
  let match = urlRegex.exec(input);
  while (match) {
    const raw = match[0];
    const cleaned = raw.replace(/[),.!?]+$/, "");
    if (!isYouTubeUrl(cleaned)) {
      match = urlRegex.exec(input);
      continue;
    }

    const start = match.index;
    const end = start + cleaned.length;
    if (input.slice(0, start).trim().length > 0) {
      return input;
    }

    return `${input.slice(0, start)}${input.slice(end)}`.replace(/^\s*\n/, "");
  }

  return input;
}

export function withStandaloneImagePreviewMarkdown(input: string) {
  if (!input?.trim()) {
    return input;
  }
  return input
    .split(/\r?\n/)
    .map((line) => {
      const url = getStandaloneImageUrlFromLine(line);
      if (url) {
        return `![](${url})`;
      }
      return line;
    })
    .join("\n");
}

export function getTransformedImageUrl(
  originalUrl: string,
  options: { width: number; quality?: number; fit?: "cover" | "contain" } = { width: 1200 }
) {
  if (!originalUrl) {
    return originalUrl;
  }

  const width = Math.max(200, Math.min(1920, Math.round(options.width)));
  const quality = Math.max(50, Math.min(100, options.quality ?? 90));
  const fit = options.fit ?? "cover";
  if (!IMAGE_TRANSFORM_BASE_URL) {
    return originalUrl;
  }

  const transformOrigin = (() => {
    try {
      return new URL(IMAGE_TRANSFORM_BASE_URL).origin;
    } catch {
      return "";
    }
  })();

  if (!transformOrigin || transformOrigin.includes("localhost")) {
    return originalUrl;
  }

  let source = originalUrl;
  try {
    const original = new URL(originalUrl);
    const transform = new URL(transformOrigin);
    if (original.origin !== transform.origin) {
      return originalUrl;
    }
    const normalizedPath = original.pathname.replace(/^\/+/, "");
    source = `${normalizedPath}${original.search}`;
  } catch {
    return originalUrl;
  }

  return `${transformOrigin}/cdn-cgi/image/width=${width},quality=${quality},fit=${fit},format=auto/${source}`;
}
