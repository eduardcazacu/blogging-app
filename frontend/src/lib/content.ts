import { IMAGE_TRANSFORM_BASE_URL } from "../config";

const IMAGE_URL_REGEX = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|avif)(?:\?\S*)?$/i;

export function normalizeMarkdownWithInlineImages(input: string) {
  if (!input?.trim()) {
    return "";
  }
  return input
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (IMAGE_URL_REGEX.test(trimmed)) {
        return `![](${trimmed})`;
      }
      return line;
    })
    .join("\n");
}

export function toCardPreviewText(input: string) {
  if (!input) {
    return "";
  }

  return input
    .replace(/!\[[^\]]*]\(([^)]+)\)/g, "")
    .split(/\r?\n/)
    .filter((line) => !IMAGE_URL_REGEX.test(line.trim()))
    .join("\n")
    .trim();
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
  const transformOrigin = (() => {
    if (IMAGE_TRANSFORM_BASE_URL) {
      try {
        return new URL(IMAGE_TRANSFORM_BASE_URL).origin;
      } catch {
        return "";
      }
    }
    try {
      return new URL(originalUrl).origin;
    } catch {
      return "";
    }
  })();

  if (!transformOrigin || transformOrigin.includes("localhost")) {
    return originalUrl;
  }

  return `${transformOrigin}/cdn-cgi/image/width=${width},quality=${quality},fit=${fit},format=auto/${originalUrl}`;
}
