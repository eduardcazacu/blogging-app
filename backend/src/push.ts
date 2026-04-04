import webPush from "web-push";
import { getPrismaClient } from "./prisma";

type VapidConfig = {
  vapidPublicKey?: string | null;
  vapidPrivateKey?: string | null;
  vapidSubject?: string | null;
};

type NewPostNotificationInput = {
  databaseUrl: string;
  authorId: number;
  authorName: string;
  postId: number;
  postTitle: string;
  vapidConfig: VapidConfig;
};

type TestNotificationInput = {
  databaseUrl: string;
  userId: number;
  vapidConfig: VapidConfig;
  title?: string;
  body?: string;
};

type BroadcastNotificationInput = {
  databaseUrl: string;
  title: string;
  body: string;
  vapidConfig: VapidConfig;
};

type PushDeliverySuccess = {
  subscriptionId: number;
  endpoint: string;
  success: true;
  statusCode?: number | null;
};

type PushDeliveryFailure = {
  subscriptionId: number | null;
  endpoint: string | null;
  success: false;
  statusCode: number | null;
  errorMessage: string;
};

type PushDeliveryResult = PushDeliverySuccess | PushDeliveryFailure;

function getPushErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function summarizeSubscriptionEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return `${url.origin}${url.pathname.slice(0, 24)}`;
  } catch {
    return endpoint.slice(0, 48);
  }
}

function flattenSettledDeliveryResults(
  responses: PromiseSettledResult<PushDeliverySuccess | PushDeliveryFailure>[]
): PushDeliveryResult[] {
  return responses.map((response) => {
    if (response.status === "rejected") {
      return {
        subscriptionId: null,
        endpoint: null,
        success: false,
        statusCode: null,
        errorMessage: getPushErrorMessage(response.reason),
      };
    }
    return response.value;
  });
}

function getPushStatusCode(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const value = (
    (error as { statusCode?: unknown }).statusCode ??
    (error as { status?: unknown }).status ??
    (error as { code?: unknown }).code
  );
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function getVapidSubject(input: VapidConfig) {
  return input.vapidSubject?.trim() || "mailto:notifications@eddies-lounge.invalid";
}

function buildPushPayload(postId: number, authorName: string, postTitle: string) {
  return JSON.stringify({
    title: `${authorName} posted a new blog`,
    body: postTitle,
    data: {
      postId,
      openUrl: `/blog/${postId}`,
    },
  });
}

function buildTestPayload(title?: string, body?: string) {
  return JSON.stringify({
    title: title?.trim() || "Test notification",
    body: body?.trim() || "Push notifications are working.",
    data: {
      openUrl: "/",
    },
  });
}

function buildBroadcastPayload(title: string, body: string) {
  return JSON.stringify({
    title: title.trim(),
    body: body.trim(),
    data: {
      openUrl: "/blogs",
    },
  });
}

export async function notifyFollowersOfNewPost(input: NewPostNotificationInput) {
  if (!input.vapidConfig.vapidPublicKey || !input.vapidConfig.vapidPrivateKey) {
    console.warn("[push] skipping new-post notification because VAPID config is missing", {
      postId: input.postId,
      authorId: input.authorId,
      hasPublicKey: Boolean(input.vapidConfig.vapidPublicKey),
      hasPrivateKey: Boolean(input.vapidConfig.vapidPrivateKey),
      hasSubject: Boolean(input.vapidConfig.vapidSubject),
    });
    return;
  }

  try {
    const prisma = getPrismaClient(input.databaseUrl);
    const recipients = await prisma.user.findMany({
      where: {
        id: {
          not: input.authorId,
        },
        notificationsEnabled: true,
        pushSubscriptions: {
          some: {},
        },
      },
      select: {
        pushSubscriptions: {
          select: {
            id: true,
            endpoint: true,
            p256dh: true,
            auth: true,
          },
        },
      },
    });

    console.log("[push] resolved recipients for new-post notification", {
      postId: input.postId,
      authorId: input.authorId,
      recipientCount: recipients.length,
      subscriptionCount: recipients.reduce((count, user) => count + user.pushSubscriptions.length, 0),
    });

    const subscriptions = recipients.flatMap((user) => user.pushSubscriptions);
    if (subscriptions.length === 0) {
      console.log("[push] no subscriptions eligible for new-post notification", {
        postId: input.postId,
        authorId: input.authorId,
      });
      return;
    }

    webPush.setVapidDetails(
      getVapidSubject(input.vapidConfig),
      input.vapidConfig.vapidPublicKey,
      input.vapidConfig.vapidPrivateKey
    );

    const payload = buildPushPayload(input.postId, input.authorName, input.postTitle);
    const sendJobs = subscriptions.map((subscription) => {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };
      return webPush.sendNotification(pushSubscription, payload).then(() => ({
        subscriptionId: subscription.id,
        endpoint: summarizeSubscriptionEndpoint(subscription.endpoint),
        success: true as const,
      })).catch((error: unknown) => ({
        subscriptionId: subscription.id,
        endpoint: summarizeSubscriptionEndpoint(subscription.endpoint),
        success: false as const,
        statusCode: getPushStatusCode(error),
        errorMessage: getPushErrorMessage(error),
      }));
    });

    const responses = await Promise.allSettled(sendJobs);
    const deliveryResults = flattenSettledDeliveryResults(responses);
    const deliveredCount = deliveryResults.filter((result) => result.success).length;
    const failedResults = deliveryResults.filter((result) => !result.success);
    console.log("[push] completed new-post notification delivery", {
      postId: input.postId,
      authorId: input.authorId,
      attempted: deliveryResults.length,
      delivered: deliveredCount,
      failed: failedResults.length,
      failures: failedResults.map((result) => ({
        subscriptionId: result.subscriptionId,
        endpoint: result.endpoint,
        statusCode: result.statusCode,
        errorMessage: result.errorMessage,
      })),
    });

    const invalidSubscriptionIds = responses.flatMap((response) => {
      if (response.status === "rejected") {
        return [];
      }
      if (!response.value.success) {
        return response.value.statusCode === 404 || response.value.statusCode === 410
          ? [response.value.subscriptionId]
          : [];
      }
      return [];
    });

    if (invalidSubscriptionIds.length > 0) {
      console.warn("[push] removing invalid subscriptions after new-post notification", {
        postId: input.postId,
        invalidSubscriptionIds,
      });
      await prisma.userPushSubscription.deleteMany({
        where: {
          id: {
            in: invalidSubscriptionIds,
          },
        },
      });
    }
  } catch (error) {
    console.error("Failed to send push notifications for new post.", error);
  }
}

export async function sendTestNotificationToUser(input: TestNotificationInput) {
  if (!input.vapidConfig.vapidPublicKey || !input.vapidConfig.vapidPrivateKey) {
    console.warn("[push] test notification aborted because VAPID config is missing", {
      userId: input.userId,
      hasPublicKey: Boolean(input.vapidConfig.vapidPublicKey),
      hasPrivateKey: Boolean(input.vapidConfig.vapidPrivateKey),
      hasSubject: Boolean(input.vapidConfig.vapidSubject),
    });
    throw new Error("Push notifications are not configured.");
  }

  const prisma = getPrismaClient(input.databaseUrl);
  const user = await prisma.user.findUnique({
    where: {
      id: input.userId,
    },
    select: {
      notificationsEnabled: true,
      pushSubscriptions: {
        select: {
          id: true,
          endpoint: true,
          p256dh: true,
          auth: true,
        },
      },
    },
  });

  if (!user || !user.notificationsEnabled) {
    console.warn("[push] test notification blocked because user is not eligible", {
      userId: input.userId,
      userFound: Boolean(user),
      notificationsEnabled: user?.notificationsEnabled ?? false,
    });
    throw new Error("Push notifications are disabled for this user.");
  }

  if (user.pushSubscriptions.length === 0) {
    console.warn("[push] test notification blocked because user has no subscriptions", {
      userId: input.userId,
    });
    throw new Error("No active device subscription found for this user.");
  }

  console.log("[push] sending test notification", {
    userId: input.userId,
    subscriptionCount: user.pushSubscriptions.length,
  });

  webPush.setVapidDetails(
    getVapidSubject(input.vapidConfig),
    input.vapidConfig.vapidPublicKey,
    input.vapidConfig.vapidPrivateKey
  );

  const payload = buildTestPayload(input.title, input.body);
  const sendJobs = user.pushSubscriptions.map((subscription) => {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };
    return webPush.sendNotification(pushSubscription, payload).then(() => ({
      subscriptionId: subscription.id,
      endpoint: summarizeSubscriptionEndpoint(subscription.endpoint),
      statusCode: null as number | null,
      success: true as const,
    })).catch((error: unknown) => ({
      subscriptionId: subscription.id,
      endpoint: summarizeSubscriptionEndpoint(subscription.endpoint),
      statusCode: getPushStatusCode(error),
      errorMessage: getPushErrorMessage(error),
      success: false as const,
    }));
  });

  const responses = await Promise.allSettled(sendJobs);
  const deliveryResults = flattenSettledDeliveryResults(responses);
  const deliveredCount = deliveryResults.filter((result) => result.success).length;
  const failedResults = deliveryResults.filter((result) => !result.success);
  console.log("[push] completed test notification delivery", {
    userId: input.userId,
    attempted: deliveryResults.length,
    delivered: deliveredCount,
    failed: failedResults.length,
    failures: failedResults.map((result) => ({
      subscriptionId: result.subscriptionId,
      endpoint: result.endpoint,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
    })),
  });

  const invalidSubscriptionIds = responses.flatMap((response) => {
    if (response.status === "rejected") {
      return [];
    }
    if (!response.value.success) {
      return response.value.statusCode === 404 || response.value.statusCode === 410
        ? [response.value.subscriptionId]
        : [];
    }
    return [];
  });

  if (invalidSubscriptionIds.length > 0) {
    console.warn("[push] removing invalid subscriptions after test notification", {
      userId: input.userId,
      invalidSubscriptionIds,
    });
    await prisma.userPushSubscription.deleteMany({
      where: {
        id: {
          in: invalidSubscriptionIds,
        },
      },
    });
  }

  if (invalidSubscriptionIds.length === user.pushSubscriptions.length) {
    throw new Error("No valid device subscription found for delivery.");
  }
}

export async function sendBroadcastNotification(input: BroadcastNotificationInput) {
  if (!input.vapidConfig.vapidPublicKey || !input.vapidConfig.vapidPrivateKey) {
    console.warn("[push] broadcast notification aborted because VAPID config is missing", {
      hasPublicKey: Boolean(input.vapidConfig.vapidPublicKey),
      hasPrivateKey: Boolean(input.vapidConfig.vapidPrivateKey),
      hasSubject: Boolean(input.vapidConfig.vapidSubject),
    });
    throw new Error("Push notifications are not configured.");
  }

  const prisma = getPrismaClient(input.databaseUrl);
  const recipients = await prisma.user.findMany({
    where: {
      notificationsEnabled: true,
      pushSubscriptions: {
        some: {},
      },
    },
    select: {
      id: true,
      pushSubscriptions: {
        select: {
          id: true,
          endpoint: true,
          p256dh: true,
          auth: true,
        },
      },
    },
  });

  console.log("[push] resolved recipients for broadcast notification", {
    recipientCount: recipients.length,
    subscriptionCount: recipients.reduce((count, user) => count + user.pushSubscriptions.length, 0),
  });

  const subscriptions = recipients.flatMap((user) => user.pushSubscriptions);
  if (subscriptions.length === 0) {
    throw new Error("No subscribed users available for broadcast.");
  }

  webPush.setVapidDetails(
    getVapidSubject(input.vapidConfig),
    input.vapidConfig.vapidPublicKey,
    input.vapidConfig.vapidPrivateKey
  );

  const payload = buildBroadcastPayload(input.title, input.body);
  const sendJobs = subscriptions.map((subscription) => {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };
    return webPush.sendNotification(pushSubscription, payload).then(() => ({
      subscriptionId: subscription.id,
      endpoint: summarizeSubscriptionEndpoint(subscription.endpoint),
      statusCode: null as number | null,
      success: true as const,
    })).catch((error: unknown) => ({
      subscriptionId: subscription.id,
      endpoint: summarizeSubscriptionEndpoint(subscription.endpoint),
      statusCode: getPushStatusCode(error),
      errorMessage: getPushErrorMessage(error),
      success: false as const,
    }));
  });

  const responses = await Promise.allSettled(sendJobs);
  const deliveryResults = flattenSettledDeliveryResults(responses);
  const deliveredCount = deliveryResults.filter((result) => result.success).length;
  const failedResults = deliveryResults.filter((result) => !result.success);

  console.log("[push] completed broadcast notification delivery", {
    attempted: deliveryResults.length,
    delivered: deliveredCount,
    failed: failedResults.length,
    failures: failedResults.map((result) => ({
      subscriptionId: result.subscriptionId,
      endpoint: result.endpoint,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
    })),
  });

  const invalidSubscriptionIds = responses.flatMap((response) => {
    if (response.status === "rejected") {
      return [];
    }
    if (!response.value.success) {
      return response.value.statusCode === 404 || response.value.statusCode === 410
        ? [response.value.subscriptionId]
        : [];
    }
    return [];
  });

  if (invalidSubscriptionIds.length > 0) {
    console.warn("[push] removing invalid subscriptions after broadcast notification", {
      invalidSubscriptionIds,
    });
    await prisma.userPushSubscription.deleteMany({
      where: {
        id: {
          in: invalidSubscriptionIds,
        },
      },
    });
  }

  if (deliveredCount === 0) {
    throw new Error("Broadcast delivery failed for all subscribed devices.");
  }

  return {
    attempted: deliveryResults.length,
    delivered: deliveredCount,
    failed: failedResults.length,
  };
}
