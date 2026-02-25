import { IMAGE_TRANSFORM_BASE_URL } from "../config";

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

  let source = originalUrl;
  try {
    const original = new URL(originalUrl);
    const transform = new URL(transformOrigin);
    if (original.origin === transform.origin) {
      const normalizedPath = original.pathname.replace(/^\/+/, "");
      source = `${normalizedPath}${original.search}`;
    }
  } catch {
    source = originalUrl;
  }

  return `${transformOrigin}/cdn-cgi/image/width=${width},quality=${quality},fit=${fit},format=auto/${source}`;
}
