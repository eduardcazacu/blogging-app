import axios from "axios";
import { BACKEND_URL } from "../config";

const PUSH_PERMISSION_PROMPT_VERSION = "2026-03-20-notifications-v2";
const PUSH_PERMISSION_PROMPT_KEY = "push.permissionPromptVersion";

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

export function isPushNotificationSupported() {
  if (typeof window === "undefined") {
    return false;
  }
  return !!("serviceWorker" in navigator) && !!("Notification" in window) && !!("PushManager" in window);
}

async function getPushPublicKey(authHeader: string) {
  const response = await axios.get(`${BACKEND_URL}/api/v1/user/me/push/key`, {
    headers: {
      Authorization: authHeader,
    },
  });
  const publicKey = typeof response.data?.publicKey === "string" ? response.data.publicKey.trim() : "";
  if (!publicKey) {
    throw new Error("Push key is not available");
  }
  return publicKey;
}

async function subscribePushDevice(authHeader: string) {
  const publicKey = await getPushPublicKey(authHeader);
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
        Authorization: authHeader,
      },
    }
  );
}

function hasPromptedForCurrentVersion() {
  return (
    typeof localStorage !== "undefined" &&
    localStorage.getItem(PUSH_PERMISSION_PROMPT_KEY) === PUSH_PERMISSION_PROMPT_VERSION
  );
}

function markPromptedForCurrentVersion() {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(PUSH_PERMISSION_PROMPT_KEY, PUSH_PERMISSION_PROMPT_VERSION);
  }
}

export function shouldPromptForNotificationPermission() {
  return isPushNotificationSupported() && Notification.permission === "default" && !hasPromptedForCurrentVersion();
}

export function markNotificationPermissionPromptAsHandled() {
  markPromptedForCurrentVersion();
}

export async function promptForNotificationPermissionOnFirstOpenAfterUpdate(authHeader: string) {
  if (!isPushNotificationSupported()) {
    return;
  }
  if (Notification.permission !== "default" || hasPromptedForCurrentVersion()) {
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "default") {
      markPromptedForCurrentVersion();
    }
    if (permission !== "granted") {
      return;
    }

    await subscribePushDevice(authHeader);
  } catch (error) {
    // Some browsers (notably Safari) may block permission prompts unless called from a user gesture.
    // In that case, skip marking this as handled so we can try again on next app open.
    throw error;
  }
}

export async function enablePushIfPermissionGranted(authHeader: string) {
  if (!isPushNotificationSupported()) {
    return;
  }
  if (Notification.permission !== "granted") {
    return;
  }

  await subscribePushDevice(authHeader);
}
