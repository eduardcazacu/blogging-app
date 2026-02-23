import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Appbar } from "../components/Appbar";
import { BACKEND_URL } from "../config";
import { clearAuthStorage, getAuthHeader, isAuthErrorStatus } from "../lib/auth";
import { Navigate } from "react-router-dom";

const BIO_MAX_LENGTH = 100;

type Profile = {
  id: number;
  email: string;
  name: string | null;
  bio: string;
  isAdmin: boolean;
};

export const Account = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bio, setBio] = useState("");
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
        localStorage.setItem("userEmail", user.email.toLowerCase());
        localStorage.setItem("isAdmin", user.isAdmin ? "true" : "false");
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
        { bio },
        {
          headers: {
            Authorization: getAuthHeader(),
          },
        }
      );
      const user = response.data?.user as { name: string | null; bio: string };
      setBio(user.bio ?? "");
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

  return (
    <div>
      <Appbar />
      <div className="flex justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div className="w-full max-w-screen-md rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
          <h1 className="text-2xl font-bold">Account</h1>
          {loading ? (
            <p className="pt-4 text-slate-600">Loading profile...</p>
          ) : (
            <>
              <div className="pt-4 text-slate-700">
                <div className="font-medium">{profile?.name || "User"}</div>
                <div className="text-sm text-slate-500">{profile?.email || ""}</div>
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

              {error ? <div className="pt-3 text-sm text-red-600">{error}</div> : null}
              {success ? <div className="pt-3 text-sm text-green-600">{success}</div> : null}

              <button
                onClick={saveBio}
                disabled={saving}
                type="button"
                className="mt-4 inline-flex items-center rounded-full bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Bio"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Account;
