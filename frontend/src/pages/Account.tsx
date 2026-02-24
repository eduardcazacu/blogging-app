import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Appbar } from "../components/Appbar";
import { Avatar } from "../components/BlogCard";
import { BACKEND_URL } from "../config";
import { clearAuthStorage, getAuthHeader, isAuthErrorStatus } from "../lib/auth";
import { Navigate } from "react-router-dom";
import { DEFAULT_THEME_KEY, getThemePalette, THEME_PALETTES } from "../themes";
import type { ThemeKey } from "@blogging-app/common";

const BIO_MAX_LENGTH = 100;

type Profile = {
  id: number;
  email: string;
  name: string | null;
  bio: string;
  themeKey?: string | null;
  isAdmin: boolean;
};

export const Account = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bio, setBio] = useState("");
  const [themeKey, setThemeKey] = useState<ThemeKey>(DEFAULT_THEME_KEY);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [authExpired, setAuthExpired] = useState(false);

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
      }
    }

    loadProfile();
  }, []);

  const remainingChars = useMemo(() => BIO_MAX_LENGTH - bio.length, [bio.length]);

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

  if (authExpired) {
    return <Navigate to="/signin" replace />;
  }

  const currentTheme = getThemePalette(themeKey);

  return (
    <div>
      <Appbar />
      <div className="flex justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div
          className="w-full max-w-screen-md rounded-xl border p-5 sm:p-8"
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
                      key={theme.key}
                      type="button"
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
      </div>
    </div>
  );
};

export default Account;
