import { useEffect, useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

type EmailRecipient = {
  id: number;
  email: string;
  name: string | null;
};

export const Admin = () => {
  const [loading, setLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailPreview, setEmailPreview] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);
  const [showRecipients, setShowRecipients] = useState(false);
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

  async function loadEmailRecipients() {
    setRecipientsLoading(true);
    setRecipientsError(null);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/v1/admin/email/recipients`, {
        headers: {
          Authorization: getAuthHeader(),
        },
      });
      setEmailRecipients(response.data?.recipients ?? []);
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (isAuthErrorStatus(e.response?.status)) {
          clearAuthStorage();
          setAuthExpired(true);
          return;
        }
        setRecipientsError(e.response?.data?.msg || "Failed to load email recipients");
      } else {
        setRecipientsError("Failed to load email recipients");
      }
    } finally {
      setRecipientsLoading(false);
    }
  }

  useEffect(() => {
    loadPendingUsers();
    loadEmailRecipients();
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

  async function sendBroadcast() {
    const title = broadcastTitle.trim();
    const body = broadcastBody.trim();
    if (!title || !body) {
      setBroadcastMessage("Title and message are required.");
      return;
    }

    setSendingBroadcast(true);
    setBroadcastMessage(null);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/v1/admin/push/broadcast`,
        { title, body },
        {
          headers: {
            Authorization: getAuthHeader(),
          },
        }
      );
      setBroadcastMessage(response.data?.msg || "Broadcast sent.");
      setBroadcastTitle("");
      setBroadcastBody("");
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (isAuthErrorStatus(e.response?.status)) {
          clearAuthStorage();
          setAuthExpired(true);
          return;
        }
        setBroadcastMessage(e.response?.data?.msg || "Failed to send broadcast notification");
      } else {
        setBroadcastMessage("Failed to send broadcast notification");
      }
    } finally {
      setSendingBroadcast(false);
    }
  }

  async function sendEmailBroadcast() {
    const subject = emailSubject.trim();
    const body = emailBody.trim();
    if (!subject || !body) {
      setEmailMessage("Subject and message are required.");
      return;
    }

    if (!window.confirm("Send this email to every approved user?")) {
      return;
    }

    setSendingEmail(true);
    setEmailMessage(null);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/v1/admin/email/broadcast`,
        { subject, body },
        {
          headers: {
            Authorization: getAuthHeader(),
          },
        }
      );
      setEmailMessage(response.data?.msg || "Email sent.");
      setEmailSubject("");
      setEmailBody("");
      setEmailPreview(false);
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (isAuthErrorStatus(e.response?.status)) {
          clearAuthStorage();
          setAuthExpired(true);
          return;
        }
        setEmailMessage(e.response?.data?.msg || "Failed to send broadcast email");
      } else {
        setEmailMessage("Failed to send broadcast email");
      }
    } finally {
      setSendingEmail(false);
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

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-lg font-semibold text-slate-900">Push Broadcast</div>
            <p className="mt-1 text-sm text-slate-600">
              Send a custom push notification to every subscribed user with notifications enabled.
            </p>
            <div className="mt-4 grid gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
                <input
                  type="text"
                  value={broadcastTitle}
                  maxLength={120}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900"
                  placeholder="Notification title"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
                <textarea
                  value={broadcastBody}
                  maxLength={500}
                  rows={4}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900"
                  placeholder="Notification message"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={sendBroadcast}
                  disabled={sendingBroadcast}
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingBroadcast ? "Sending..." : "Send push notification"}
                </button>
                {broadcastMessage ? (
                  <span className="text-sm text-slate-700">{broadcastMessage}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="text-lg font-semibold text-slate-900">Email Broadcast</div>
            <p className="mt-1 text-sm text-slate-600">
              Send an email to every approved user. The message body supports Markdown.
            </p>
            <div className="mt-4 grid gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  maxLength={200}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900"
                  placeholder="Email subject"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">
                    Message (Markdown)
                  </label>
                  <button
                    type="button"
                    onClick={() => setEmailPreview((value) => !value)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    {emailPreview ? "Edit" : "Preview"}
                  </button>
                </div>
                {emailPreview ? (
                  <div className="markdown-body min-h-[8rem] rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900">
                    {emailBody.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {emailBody}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-slate-400">Nothing to preview yet.</p>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={emailBody}
                    maxLength={20000}
                    rows={10}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm text-slate-900"
                    placeholder={"# Hello\n\nWrite your update with **Markdown**. Lists, [links](https://example.com), and code all work."}
                  />
                )}
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-700">
                    {recipientsLoading
                      ? "Loading recipients..."
                      : recipientsError
                      ? <span className="text-red-600">{recipientsError}</span>
                      : `Will send to ${emailRecipients.length} approved user${emailRecipients.length === 1 ? "" : "s"}.`}
                  </div>
                  {!recipientsLoading && !recipientsError && emailRecipients.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowRecipients((value) => !value)}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      {showRecipients ? "Hide" : "Show"} recipients
                    </button>
                  ) : null}
                </div>
                {showRecipients && !recipientsLoading && !recipientsError ? (
                  <ul className="mt-2 max-h-48 overflow-y-auto divide-y divide-slate-100 text-sm">
                    {emailRecipients.map((recipient) => (
                      <li key={recipient.id} className="py-1.5">
                        <span className="text-slate-900 break-all">{recipient.email}</span>
                        {recipient.name?.trim() ? (
                          <span className="text-slate-500"> — {recipient.name}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={sendEmailBroadcast}
                  disabled={sendingEmail}
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingEmail ? "Sending..." : "Send email to all users"}
                </button>
                {emailMessage ? (
                  <span className="text-sm text-slate-700">{emailMessage}</span>
                ) : null}
              </div>
            </div>
          </div>

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
