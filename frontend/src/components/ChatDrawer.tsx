import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Avatar } from "./BlogCard";
import { useChat } from "../hooks";
import { getThemePalette, DEFAULT_THEME_KEY } from "../themes";
import { getAuthHeader, getCurrentUserId } from "../lib/auth";

function formatChatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export const ChatDrawer = () => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [retentionDraft, setRetentionDraft] = useState("24");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const {
    messages,
    loading,
    sending,
    retentionHours,
    authExpired,
    sendMessage,
    updateSettings,
  } = useChat(open);

  const listRef = useRef<HTMLDivElement | null>(null);
  const currentUserId = getCurrentUserId();
  const isAdmin = localStorage.getItem("isAdmin") === "true";
  const myThemeKey = localStorage.getItem("themeKey") || DEFAULT_THEME_KEY;
  const accent = getThemePalette(myThemeKey).accent;

  // Toggle from the nav-bar chat icon (mirrors the window-event pattern used elsewhere).
  useEffect(() => {
    const toggle = () => {
      if (!getAuthHeader()) {
        return;
      }
      setOpen((prev) => !prev);
    };
    window.addEventListener("toggle-chat", toggle);
    return () => window.removeEventListener("toggle-chat", toggle);
  }, []);

  // Close drawer if the session expires while open.
  useEffect(() => {
    if (authExpired) {
      setOpen(false);
    }
  }, [authExpired]);

  // Close on Escape.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Keep the retention input in sync when the drawer (re)opens.
  useEffect(() => {
    if (open) {
      setRetentionDraft(String(retentionHours));
    }
  }, [open, retentionHours]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, open]);

  if (!open) {
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) {
      return;
    }
    const ok = await sendMessage(draft);
    if (ok) {
      setDraft("");
    }
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onSubmit(e);
    }
  }

  async function onSaveSettings(e: FormEvent) {
    e.preventDefault();
    const hours = Number(retentionDraft);
    if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
      setSettingsMessage("Enter a whole number of hours between 1 and 720.");
      return;
    }
    setSettingsBusy(true);
    setSettingsMessage(null);
    try {
      await updateSettings(hours);
      setSettingsMessage("Saved.");
      setShowSettings(false);
    } catch {
      setSettingsMessage("Failed to save settings.");
    } finally {
      setSettingsBusy(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 sm:bg-black/20"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-y-0 sm:right-0 sm:left-auto sm:w-96 sm:border-l sm:border-slate-200 sm:shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Lounge Chat"
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-800">Lounge Chat</div>
            <div className="text-xs text-slate-500">
              Messages vanish after {retentionHours}h
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setSettingsMessage(null);
                  setShowSettings((prev) => !prev);
                }}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Chat settings"
                title="Chat settings"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close chat"
              title="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Admin settings panel */}
        {isAdmin && showSettings ? (
          <form
            onSubmit={onSaveSettings}
            className="border-b border-slate-200 bg-slate-50 px-4 py-3"
          >
            <label className="block text-xs font-medium text-slate-600">
              Auto-delete messages after (hours)
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={720}
                value={retentionDraft}
                onChange={(e) => setRetentionDraft(e.target.value)}
                className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2"
                style={{ outlineColor: accent }}
              />
              <button
                type="submit"
                disabled={settingsBusy}
                className="rounded-md px-3 py-1 text-sm font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {settingsBusy ? "Saving..." : "Save"}
              </button>
            </div>
            {settingsMessage ? (
              <div className="mt-1.5 text-xs text-slate-500">{settingsMessage}</div>
            ) : null}
          </form>
        ) : null}

        {/* Messages */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4">
          {loading && messages.length === 0 ? (
            <div className="mt-6 text-center text-sm text-slate-400">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="mt-6 text-center text-sm text-slate-400">
              No messages yet. Say hi 👋
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((message) => {
                const mine = currentUserId != null && message.author.id === currentUserId;
                const bubbleColor = getThemePalette(message.author.themeKey).accent;
                return (
                  <div
                    key={message.id}
                    className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <Avatar
                      size="small"
                      name={message.author.name || "?"}
                      themeKey={message.author.themeKey}
                      imageUrl={message.author.profilePictureUrl}
                    />
                    <div
                      className={`flex max-w-[75%] flex-col ${mine ? "items-end" : "items-start"}`}
                    >
                      {!mine ? (
                        <div className="mb-0.5 px-1 text-xs font-medium text-slate-500">
                          {message.author.name || "Anonymous"}
                        </div>
                      ) : null}
                      <div
                        className="whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm text-white"
                        style={{ backgroundColor: bubbleColor }}
                      >
                        {message.content}
                      </div>
                      <div className="mt-0.5 px-1 text-[10px] text-slate-400">
                        {formatChatTime(message.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={onSubmit}
          className="flex items-end gap-2 border-t border-slate-200 px-3 py-3"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder="Message the lounge…"
            rows={1}
            maxLength={1000}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ outlineColor: accent }}
          />
          <button
            type="submit"
            disabled={sending || draft.trim().length === 0}
            className="rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            Send
          </button>
        </form>
      </div>
    </>
  );
};
