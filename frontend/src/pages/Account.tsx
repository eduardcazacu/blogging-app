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
  profilePictureUrl?: string | null;
};

const PROFILE_PICTURE_MAX_WIDTH = 512;
const PROFILE_PICTURE_MAX_HEIGHT = 512;
const PROFILE_PICTURE_TARGET_BYTES = 400_000;
const PROFILE_PICTURE_MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

async function loadImageDimensions(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("Failed to read image dimensions."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function resizeProfilePicture(file: File) {
  if (file.type === "image/gif") {
    const { width, height } = await loadImageDimensions(file);
    if (width > 1024 || height > 1024) {
      throw new Error("GIF is larger than 1024x1024. Please upload a smaller GIF.");
    }
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to load image."));
      img.src = objectUrl;
    });

    const baseScale = Math.min(
      1,
      PROFILE_PICTURE_MAX_WIDTH / image.naturalWidth,
      PROFILE_PICTURE_MAX_HEIGHT / image.naturalHeight
    );
    let workingWidth = Math.max(1, Math.round(image.naturalWidth * baseScale));
    let workingHeight = Math.max(1, Math.round(image.naturalHeight * baseScale));
    let bestBlob: Blob | null = null;
    const qualityLevels = [0.92, 0.85, 0.78, 0.7];

    for (let pass = 0; pass < 4; pass++) {
      const canvas = document.createElement("canvas");
      canvas.width = workingWidth;
      canvas.height = workingHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas is unavailable in this browser.");
      }
      context.drawImage(image, 0, 0, workingWidth, workingHeight);

      for (const quality of qualityLevels) {
        const candidate = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, "image/webp", quality);
        });
        if (!candidate) {
          continue;
        }
        bestBlob = candidate;
        if (candidate.size <= PROFILE_PICTURE_TARGET_BYTES) {
          break;
        }
      }

      if (bestBlob && bestBlob.size <= PROFILE_PICTURE_TARGET_BYTES) {
        break;
      }

      workingWidth = Math.max(160, Math.round(workingWidth * 0.85));
      workingHeight = Math.max(160, Math.round(workingHeight * 0.85));
    }

    if (!bestBlob) {
      throw new Error("Failed to process image.");
    }

    const outputName = file.name.replace(/\.[^.]+$/, ".webp");
    return new File([bestBlob], outputName, { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function persistProfilePicture(url: string | null) {
  if (url) {
    localStorage.setItem("profilePictureUrl", url);
  } else {
    localStorage.removeItem("profilePictureUrl");
  }
  window.dispatchEvent(new Event("profile-picture-changed"));
}

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
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);
  const [deletingProfilePicture, setDeletingProfilePicture] = useState(false);
  const [profilePictureError, setProfilePictureError] = useState<string | null>(null);

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
        setProfilePictureUrl(user?.profilePictureUrl ?? null);
        const selectedTheme = THEME_PALETTES.find((theme) => theme.key === user?.themeKey)?.key ?? DEFAULT_THEME_KEY;
        setThemeKey(selectedTheme);
        localStorage.setItem("userEmail", user.email.toLowerCase());
        localStorage.setItem("isAdmin", user.isAdmin ? "true" : "false");
        localStorage.setItem("themeKey", selectedTheme);
        if (user.name?.trim()) {
          localStorage.setItem("displayName", user.name.trim());
        }
        persistProfilePicture(user?.profilePictureUrl ?? null);
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

  useEffect(() => {
    const handler = () => {
      setNotificationsEnabled(true);
      void refreshPushState();
    };
    window.addEventListener("push-subscription-changed", handler);
    return () => window.removeEventListener("push-subscription-changed", handler);
  }, []);

  async function uploadProfilePicture(file: File) {
    if (!file.type.startsWith("image/")) {
      setProfilePictureError("Please choose an image file.");
      return;
    }
    setProfilePictureError(null);
    setUploadingProfilePicture(true);
    try {
      const optimized = await resizeProfilePicture(file);
      if (optimized.size > PROFILE_PICTURE_MAX_UPLOAD_BYTES) {
        throw new Error("Image is still too large after optimization (max 3MB).");
      }
      const formData = new FormData();
      formData.append("image", optimized);
      const response = await axios.post(
        `${BACKEND_URL}/api/v1/user/me/profile-picture`,
        formData,
        {
          headers: {
            Authorization: getAuthHeader(),
          },
        }
      );
      const nextUrl = (response.data?.profilePictureUrl as string | null) ?? null;
      setProfilePictureUrl(nextUrl);
      persistProfilePicture(nextUrl);
      setSuccess("Profile picture updated.");
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (isAuthErrorStatus(e.response?.status)) {
          clearAuthStorage();
          setAuthExpired(true);
          return;
        }
        setProfilePictureError(e.response?.data?.msg || "Failed to upload profile picture.");
      } else if (e instanceof Error) {
        setProfilePictureError(e.message);
      } else {
        setProfilePictureError("Failed to upload profile picture.");
      }
    } finally {
      setUploadingProfilePicture(false);
    }
  }

  async function deleteProfilePicture() {
    setProfilePictureError(null);
    setDeletingProfilePicture(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/v1/user/me/profile-picture/delete`,
        {},
        {
          headers: {
            Authorization: getAuthHeader(),
          },
        }
      );
      setProfilePictureUrl(null);
      persistProfilePicture(null);
      setSuccess("Profile picture removed.");
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (isAuthErrorStatus(e.response?.status)) {
          clearAuthStorage();
          setAuthExpired(true);
          return;
        }
        setProfilePictureError(e.response?.data?.msg || "Failed to delete profile picture.");
      } else {
        setProfilePictureError("Failed to delete profile picture.");
      }
    } finally {
      setDeletingProfilePicture(false);
    }
  }

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
                    <Avatar size="big" name={profile?.name || "User"} themeKey={themeKey} imageUrl={profilePictureUrl} />
                    <div>
                      <div className="font-medium">{profile?.name || "User"}</div>
                      <div className="text-sm text-slate-500">{profile?.email || ""}</div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border border-slate-200 p-3 sm:p-4">
                    <div className="text-sm font-medium text-slate-800">Profile picture</div>
                    <div className="mt-1 text-xs text-slate-500">
                      JPG, PNG, WEBP, or GIF. Resized to 512x512 and compressed before upload.
                    </div>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        disabled={uploadingProfilePicture || deletingProfilePicture}
                        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-60"
                        onChange={(e) => {
                          const selected = e.target.files?.[0];
                          if (selected) {
                            void uploadProfilePicture(selected);
                          }
                          e.target.value = "";
                        }}
                      />
                      {profilePictureUrl ? (
                        <button
                          type="button"
                          onClick={() => void deleteProfilePicture()}
                          disabled={uploadingProfilePicture || deletingProfilePicture}
                          className="rounded-full bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingProfilePicture ? "Removing..." : "Remove picture"}
                        </button>
                      ) : null}
                    </div>
                    {uploadingProfilePicture ? (
                      <div className="mt-2 text-sm text-slate-600">Uploading picture...</div>
                    ) : null}
                    {profilePictureError ? (
                      <div className="mt-2 text-sm text-red-600">{profilePictureError}</div>
                    ) : null}
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
