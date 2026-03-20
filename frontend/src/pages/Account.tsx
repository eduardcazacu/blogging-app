import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Appbar } from "../components/Appbar";
import { Avatar } from "../components/BlogCard";
import { Logout } from "../components/Logout";
import { BACKEND_URL } from "../config";
import { clearAuthStorage, getAuthHeader, isAuthErrorStatus } from "../lib/auth";
import { Link, Navigate } from "react-router-dom";
import { DEFAULT_THEME_KEY, getThemePalette, THEME_PALETTES } from "../themes";
import type { ThemeKey } from "@blogging-app/common";

const BIO_MAX_LENGTH = 100;

type Profile = {
  id: number;
  email: string;
  name: string | null;
  bio: string;
  themeKey?: string | null;
  notificationsEnabled: boolean;
  isAdmin: boolean;
};

function base64ToUint8Array(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.length % 4 === 0 ? normalized : `${normalized}${"=".repeat(4 - (normalized.length % 4))}`;
  const binary = atob(padded);
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    result[i] = binary.charCodeAt(i);
  }
  return result;
}

export const Account = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bio, setBio] = useState("");
  const [themeKey, setThemeKey] = useState<ThemeKey>(DEFAULT_THEME_KEY);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [authExpired, setAuthExpired] = useState(false);

  const remainingChars = useMemo(() => BIO_MAX_LENGTH - bio.length, [bio.length]);

  async function refreshPushState() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setPushSupported(false);
      return;
    }

    setPushSupported(!!("PushManager" in window) && !!("Notification" in window));
    if (typeof Notification !== "undefined") {
      setPushPermission(Notification.permission);
      if (Notification.permission !== "granted") {
        setNotificationsEnabled(false);
      }
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setDeviceSubscribed(Boolean(subscription));
    } catch {
      setDeviceSubscribed(false);
    }
  }

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/v1/user/me`, {
          headers: {
            Authorization: getAuthHeader(),
          },
        });
        const user = response.data?.user as Profile;
        setProfile(user);
        setBio(user?.bio ?? "");
        setNotificationsEnabled(Boolean(user?.notificationsEnabled));
        const selectedTheme = THEME_PALETTES.find((theme) => theme.key === user?.themeKey)?.key ?? DEFAULT_THEME_KEY;
        setThemeKey(selectedTheme);
        localStorage.setItem("userEmail", user.email.toLowerCase());
        localStorage.setItem("isAdmin", user.isAdmin ? "true" : "false");
        localStorage.setItem("themeKey", selectedTheme);
        if (user.name?.trim()) {
          localStorage.setItem("displayName", user.name.trim());
        }
      } catch (e) {
        if (axios.isAxiosError(e)) {
          if (isAuthErrorStatus(e.response?.status)) {
            clearAuthStorage();
            setAuthExpired(true);
            return;
          }
          setError(e.response?.data?.msg || "Failed to load account");
        } else {
          setError("Failed to load account");
        }
      } finally {
        setLoading(false);
        await refreshPushState();
      }
    }

    loadProfile();
    return () => {
      setError(null);
      setSuccess(null);
    };
  }, []);

  async function saveBio() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await axios.put(
        `${BACKEND_URL}/api/v1/user/me`,
        { bio, themeKey },
        {
          headers: {
            Authorization: getAuthHeader(),
          },
        }
      );
      const user = response.data?.user as { name: string | null; bio: string; themeKey?: string | null };
      setBio(user.bio ?? "");
      const selectedTheme = THEME_PALETTES.find((theme) => theme.key === user?.themeKey)?.key ?? DEFAULT_THEME_KEY;
      setThemeKey(selectedTheme);
      localStorage.setItem("themeKey", selectedTheme);
      if (user.name) {
        localStorage.setItem("displayName", user.name);
      }
      setSuccess("Profile updated");
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (isAuthErrorStatus(e.response?.status)) {
          clearAuthStorage();
          setAuthExpired(true);
          return;
        }
        setError(e.response?.data?.msg || "Failed to save bio");
      } else {
        setError("Failed to save bio");
      }
    } finally {
      setSaving(false);
    }
  }

  async function getPushPublicKey() {
    const response = await axios.get(`${BACKEND_URL}/api/v1/user/me/push/key`, {
      headers: {
        Authorization: getAuthHeader(),
      },
    });
    const publicKey = typeof response.data?.publicKey === "string" ? response.data.publicKey.trim() : "";
    if (!publicKey) {
      throw new Error("Push key is not available");
    }
    return publicKey;
  }

  async function subscribePushDevice() {
    if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
      throw new Error("Push is not supported on this browser.");
    }

    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission denied.");
      }
    }
    setPushPermission(Notification.permission);

    const publicKey = await getPushPublicKey();
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(publicKey),
      });
    }
    const subscriptionData = subscription.toJSON();
    const keys = subscriptionData.keys as
      | { p256dh?: unknown; auth?: unknown }
      | undefined;
    const p256dh = typeof keys?.p256dh === "string" ? keys.p256dh : "";
    const auth = typeof keys?.auth === "string" ? keys.auth : "";
    if (!subscriptionData.endpoint || !p256dh || !auth) {
      throw new Error("Invalid push subscription");
    }

    await axios.post(
      `${BACKEND_URL}/api/v1/user/me/push/subscribe`,
      {
        endpoint: subscriptionData.endpoint,
        keys: {
          p256dh,
          auth,
        },
        userAgent: navigator.userAgent,
      },
      {
        headers: {
          Authorization: getAuthHeader(),
        },
      }
    );
  }

  async function unsubscribePushDevice() {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
    await axios.post(
      `${BACKEND_URL}/api/v1/user/me/push/unsubscribe`,
      {},
      { headers: { Authorization: getAuthHeader() } }
    );
  }

  async function toggleNotificationSetting(checked: boolean) {
    if (!pushSupported) {
      setError("Push notifications are not supported on this device.");
      return;
    }
    setSavingNotifications(true);
    setError(null);
    setSuccess(null);

    try {
      if (checked) {
        await subscribePushDevice();
      } else {
        await unsubscribePushDevice();
      }

      await axios.put(
        `${BACKEND_URL}/api/v1/user/me/notifications`,
        { notificationsEnabled: checked },
        { headers: { Authorization: getAuthHeader() } }
      );

      setNotificationsEnabled(checked);
      await refreshPushState();
      if (checked) {
        setSuccess("Push notifications enabled.");
      } else {
        setSuccess("Push notifications disabled.");
      }
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (isAuthErrorStatus(e.response?.status)) {
          clearAuthStorage();
          setAuthExpired(true);
          return;
        }
        setError(e.response?.data?.msg || "Could not update notification settings");
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Could not update notification settings");
      }
    } finally {
      setSavingNotifications(false);
    }
  }

  if (authExpired) {
    return <Navigate to="/signin" replace />;
  }

  const currentTheme = getThemePalette(themeKey);

  return (
    <div>
      <Appbar />
      <div className="flex justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div className="w-full max-w-screen-md">
          <div
            className="rounded-xl border p-5 sm:p-8"
            style={{ borderColor: currentTheme.border, backgroundColor: currentTheme.profileBg }}
          >
            <h1 className="text-2xl font-bold">Account</h1>
            {loading ? (
              <p className="pt-4 text-slate-600">Loading profile...</p>
            ) : (
              <>
                <div className="pt-4 text-slate-700">
                  <div className="flex items-center gap-3">
                    <Avatar size="big" name={profile?.name || "User"} themeKey={themeKey} />
                    <div>
                      <div className="font-medium">{profile?.name || "User"}</div>
                      <div className="text-sm text-slate-500">{profile?.email || ""}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <label className="mb-2 block text-sm font-semibold text-gray-900">
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    maxLength={BIO_MAX_LENGTH}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Write a short bio (max 100 characters)"
                  />
                  <div className="mt-2 text-right text-xs text-slate-500">
                    {remainingChars} characters remaining
                  </div>
                </div>

                <div className="pt-6">
                  <label className="mb-2 block text-sm font-semibold text-gray-900">
                    Theme
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {THEME_PALETTES.map((theme) => (
                      <button
                        type="button"
                        key={theme.key}
                        onClick={() => setThemeKey(theme.key)}
                        className={`rounded-lg border p-2 text-left transition-colors ${
                          themeKey === theme.key ? "ring-2 ring-offset-1" : ""
                        }`}
                        style={{
                          borderColor: theme.border,
                          backgroundColor: theme.softBg,
                          color: theme.text,
                          boxShadow: themeKey === theme.key ? `0 0 0 2px ${theme.accent}` : undefined,
                        }}
                      >
                        <div className="text-xs font-semibold leading-tight">{theme.label}</div>
                        <div className="mt-1.5 flex gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.accent }} />
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.border }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200">
                  <label className="mb-2 block text-sm font-semibold text-gray-900">
                    Notifications
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notificationsEnabled}
                      disabled={!pushSupported || savingNotifications}
                      onChange={(e) => {
                        void toggleNotificationSetting(e.target.checked);
                      }}
                    />
                    <span className="text-sm text-slate-700">
                      Notify me when someone posts a new blog
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {pushSupported
                      ? `Permission: ${pushPermission}. Device subscribed: ${deviceSubscribed ? "yes" : "no"}.`
                      : "Push notifications are not supported on this browser."}
                  </div>
                </div>

                {error ? <div className="pt-3 text-sm text-red-600">{error}</div> : null}
                {success ? <div className="pt-3 text-sm text-green-600">{success}</div> : null}

                <button
                  onClick={saveBio}
                  disabled={saving}
                  type="button"
                  className="mt-4 inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: currentTheme.accent }}
                >
                  {saving ? "Saving..." : "Save account preferences"}
                </button>
              </>
            )}
          </div>

          {!loading ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="text-sm font-semibold text-slate-700">Actions</div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {profile?.isAdmin ? (
                  <Link to="/admin">
                    <button
                      type="button"
                      className="text-white bg-slate-700 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300 font-medium rounded-full text-xs px-3 py-2 text-center sm:text-sm sm:px-5 sm:py-2.5"
                    >
                      Admin
                    </button>
                  </Link>
                ) : null}
                <Logout />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Account;
