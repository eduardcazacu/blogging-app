export function normalizeToken(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  let token = raw.trim();
  if (!token) {
    return null;
  }

  if (token.startsWith("Bearer ")) {
    token = token.slice("Bearer ".length).trim();
  }

  if (token === "[object Object]") {
    return null;
  }

  if (token.startsWith("{") || token.startsWith("\"")) {
    try {
      const parsed = JSON.parse(token);
      if (typeof parsed === "string") {
        token = parsed;
      } else if (parsed && typeof parsed === "object") {
        const obj = parsed as { jwt?: unknown; token?: unknown };
        if (typeof obj.jwt === "string") {
          token = obj.jwt;
        } else if (typeof obj.token === "string") {
          token = obj.token;
        }
      }
    } catch {
      return null;
    }
  }

  return token;
}

export function persistTokenFromResponse(data: unknown): string | null {
  const raw =
    typeof data === "string"
      ? data
      : typeof data === "object" && data !== null
        ? ((data as { jwt?: unknown; token?: unknown }).jwt ??
          (data as { jwt?: unknown; token?: unknown }).token ??
          null)
        : null;

  const token = normalizeToken(raw);
  if (!token) {
    return null;
  }

  localStorage.setItem("token", token);
  return token;
}

export function getAuthHeader() {
  const token = normalizeToken(localStorage.getItem("token"));
  if (!token) {
    localStorage.removeItem("token");
    return "";
  }
  return `Bearer ${token}`;
}

export function clearAuthStorage() {
  localStorage.removeItem("token");
  localStorage.removeItem("displayName");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("isAdmin");
  localStorage.removeItem("themeKey");
}

export function isAuthErrorStatus(status?: number) {
  return status === 401 || status === 403;
}
