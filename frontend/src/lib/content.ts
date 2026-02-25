import { IMAGE_TRANSFORM_BASE_URL } from "../config";

const IMAGE_URL_REGEX = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|avif)(?:[?#]\S*)?$/i;
const MARKDOWN_LINK_REGEX = /^\[[^\]]*]\((https?:\/\/\S+)\)$/i;
const AUTOLINK_REGEX = /^<(https?:\/\/\S+)>$/i;

export function isImageLikeUrl(url?: string | null) {
  if (!url) {
    return false;
  }
  return IMAGE_URL_REGEX.test(url.trim());
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
  const quality = Math.max(50, Math.min(90, options.quality ?? 78));
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
