import axios from "axios";
import { BACKEND_URL } from "../config";

const PUSH_PROMPT_SUPPRESSED_KEY = "push.promptSuppressed";

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

export async function subscribePushDevice(authHeader: string) {
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

  await axios.put(
    `${BACKEND_URL}/api/v1/user/me/notifications`,
    { notificationsEnabled: true },
    { headers: { Authorization: authHeader } }
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("push-subscription-changed"));
  }
}

export function isPushPromptSuppressed() {
  return (
    typeof localStorage !== "undefined" &&
    localStorage.getItem(PUSH_PROMPT_SUPPRESSED_KEY) === "1"
  );
}

export function suppressPushPrompt() {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(PUSH_PROMPT_SUPPRESSED_KEY, "1");
  }
}

export function shouldShowPushPrompt() {
  return (
    isPushNotificationSupported() &&
    Notification.permission === "default" &&
    !isPushPromptSuppressed()
  );
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
