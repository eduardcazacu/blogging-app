declare module "web-push" {
  interface PushSubscriptionKeys {
    p256dh: string;
    auth: string;
  }

  interface PushSubscription {
    endpoint: string;
    keys: PushSubscriptionKeys;
  }

  interface NotificationPayload {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }

  interface SendResult {
    [key: string]: unknown;
  }

  interface PushOptions {
    vapidDetails?: {
      subject: string;
      publicKey: string;
      privateKey: string;
    };
    TTL?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
  }

  function sendNotification(
    subscription: PushSubscription,
    payload: string,
    options?: PushOptions
  ): Promise<SendResult>;

  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;

  const webPush: {
    sendNotification: typeof sendNotification;
    setVapidDetails: typeof setVapidDetails;
  };

  export = webPush;
}
