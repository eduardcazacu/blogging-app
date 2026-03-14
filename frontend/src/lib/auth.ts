import axios, { type AxiosRequestConfig } from "axios";
import { BACKEND_URL } from "../config";

let refreshInFlight: Promise<string | null> | null = null;
let axiosAuthInitialized = false;
const AUTH_RETRY_MARKER = "__authRetried";

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

export function getCurrentUserId() {
  const token = normalizeToken(localStorage.getItem("token"));
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson) as { id?: unknown };
    const userId = Number(payload?.id);
    return Number.isFinite(userId) ? userId : null;
  } catch {
    return null;
  }
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

export async function refreshAccessToken() {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/v1/user/refresh`,
        {},
        { withCredentials: true }
      );
      return persistTokenFromResponse(response.data);
    } catch {
      // Do not clear an existing access token on refresh failures.
      // iOS PWAs can intermittently miss refresh cookies; keep current token
      // and let normal API auth checks decide when a real logout is needed.
      return normalizeToken(localStorage.getItem("token"));
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function isBackendRequest(url?: string) {
  if (!url) {
    return false;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url.startsWith(BACKEND_URL);
  }
  return url.startsWith("/api/");
}

function isRefreshRequest(url?: string) {
  return typeof url === "string" && url.includes("/api/v1/user/refresh");
}

type RetryableAxiosConfig = AxiosRequestConfig & {
  [AUTH_RETRY_MARKER]?: boolean;
};

function setAuthorizationHeader(config: { headers?: unknown }, value: string) {
  const headers = config.headers as
    | { set?: (name: string, value: string) => void }
    | Record<string, unknown>
    | undefined;
  if (headers && typeof headers === "object" && "set" in headers && typeof headers.set === "function") {
    headers.set("Authorization", value);
    return;
  }
  config.headers = {
    ...(headers && typeof headers === "object" ? headers : {}),
    Authorization: value,
  };
}

export function initializeAxiosAuth() {
  if (axiosAuthInitialized) {
    return;
  }
  axiosAuthInitialized = true;

  axios.interceptors.request.use((config) => {
    if (!isBackendRequest(config.url) || isRefreshRequest(config.url)) {
      return config;
    }

    const header = getAuthHeader();
    if (!header) {
      return config;
    }

    setAuthorizationHeader(config, header);
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error)) {
        return Promise.reject(error);
      }

      const status = error.response?.status;
      const requestConfig = error.config as RetryableAxiosConfig | undefined;
      if (
        !requestConfig ||
        !isAuthErrorStatus(status) ||
        !isBackendRequest(requestConfig.url) ||
        isRefreshRequest(requestConfig.url) ||
        requestConfig[AUTH_RETRY_MARKER]
      ) {
        return Promise.reject(error);
      }

      requestConfig[AUTH_RETRY_MARKER] = true;
      const token = await refreshAccessToken();
      if (!token) {
        return Promise.reject(error);
      }

      setAuthorizationHeader(requestConfig, `Bearer ${token}`);
      return axios(requestConfig);
    }
  );
}
