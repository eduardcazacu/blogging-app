import { useEffect, useState } from "react";
import axios from "axios";
import { Appbar } from "../components/Appbar";
import { BACKEND_URL } from "../config";
import { clearAuthStorage, getAuthHeader, isAuthErrorStatus } from "../lib/auth";
import { Navigate } from "react-router-dom";

type PendingUser = {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
};

export const Admin = () => {
  const [loading, setLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [authExpired, setAuthExpired] = useState(false);

  async function loadPendingUsers() {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/v1/admin/pending-users`, {
        headers: {
          Authorization: getAuthHeader(),
        },
      });
      setPendingUsers(response.data?.users ?? []);
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (isAuthErrorStatus(e.response?.status)) {
          clearAuthStorage();
          setAuthExpired(true);
          return;
        }
        setError(e.response?.data?.msg || "Failed to load pending users");
      } else {
        setError("Failed to load pending users");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPendingUsers();
  }, []);

  async function approveUser(id: number) {
    try {
      await axios.put(
        `${BACKEND_URL}/api/v1/admin/approve/${id}`,
        {},
        {
          headers: {
            Authorization: getAuthHeader(),
          },
        }
      );
      setPendingUsers((users) => users.filter((user) => user.id !== id));
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (isAuthErrorStatus(e.response?.status)) {
          clearAuthStorage();
          setAuthExpired(true);
          return;
        }
        alert(e.response?.data?.msg || "Failed to approve user");
      } else {
        alert("Failed to approve user");
      }
    }
  }

  async function rejectUser(id: number) {
    try {
      await axios.put(
        `${BACKEND_URL}/api/v1/admin/reject/${id}`,
        {},
        {
          headers: {
            Authorization: getAuthHeader(),
          },
        }
      );
      setPendingUsers((users) => users.filter((user) => user.id !== id));
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (isAuthErrorStatus(e.response?.status)) {
          clearAuthStorage();
          setAuthExpired(true);
          return;
        }
        alert(e.response?.data?.msg || "Failed to reject user");
      } else {
        alert("Failed to reject user");
      }
    }
  }

  if (authExpired) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <div>
      <Appbar />
      <div className="flex justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div className="w-full max-w-screen-lg rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Admin Console</h1>
            <button
              type="button"
              onClick={loadPendingUsers}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Refresh
            </button>
          </div>

          {loading ? <p className="pt-4 text-slate-600">Loading pending accounts...</p> : null}
          {error ? <p className="pt-4 text-red-600">{error}</p> : null}

          {!loading && !error && pendingUsers.length === 0 ? (
            <p className="pt-4 text-slate-600">No pending accounts.</p>
          ) : null}

          <div className="mt-4 space-y-3">
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 break-words">
                      {user.name?.trim() || "Unnamed user"}
                    </div>
                    <div className="text-sm text-slate-600 break-words">{user.email}</div>
                    <div className="text-xs text-slate-500 pt-1">
                      Requested on{" "}
                      {new Date(user.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => approveUser(user.id)}
                      className="rounded-full bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectUser(user.id)}
                      className="rounded-full bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
