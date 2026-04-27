import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getAuthHeader } from "../lib/auth";
import {
  shouldShowPushPrompt,
  subscribePushDevice,
  suppressPushPrompt,
} from "../lib/push";

export const NotificationPrompt = () => {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!getAuthHeader()) {
      setVisible(false);
      return;
    }
    setVisible(shouldShowPushPrompt());
  }, [location.pathname]);

  if (!visible) {
    return null;
  }

  async function onEnable() {
    setBusy(true);
    let permission: NotificationPermission = "default";
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = "default";
    }

    try {
      if (permission === "granted") {
        const authHeader = getAuthHeader();
        if (authHeader) {
          try {
            await subscribePushDevice(authHeader);
          } catch {
            // Subscription failed after grant; user can retry from Account page.
          }
        }
      } else if (permission === "default") {
        suppressPushPrompt();
      }
    } finally {
      setBusy(false);
      setVisible(false);
    }
  }

  function onDismiss() {
    suppressPushPrompt();
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 sm:left-auto sm:right-4 sm:w-96">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <p className="text-sm font-medium text-slate-900">
          Stay in the loop
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Get notified about new posts and replies on Eddie's Lounge.
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onEnable}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? "Enabling..." : "Enable"}
          </button>
        </div>
      </div>
    </div>
  );
};
