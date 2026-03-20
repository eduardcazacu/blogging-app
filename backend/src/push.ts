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

export async function notifyFollowersOfNewPost(input: NewPostNotificationInput) {
  if (!input.vapidConfig.vapidPublicKey || !input.vapidConfig.vapidPrivateKey) {
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

    const subscriptions = recipients.flatMap((user) => user.pushSubscriptions);
    if (subscriptions.length === 0) {
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
        success: true as const,
      })).catch((error: unknown) => ({
        subscriptionId: subscription.id,
        success: false as const,
        statusCode: getPushStatusCode(error),
      }));
    });

    const responses = await Promise.allSettled(sendJobs);
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
    throw new Error("Push notifications are disabled for this user.");
  }

  if (user.pushSubscriptions.length === 0) {
    throw new Error("No active device subscription found for this user.");
  }

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
      statusCode: null as number | null,
      success: true as const,
    })).catch((error: unknown) => ({
      subscriptionId: subscription.id,
      statusCode: getPushStatusCode(error),
      success: false as const,
    }));
  });

  const responses = await Promise.allSettled(sendJobs);
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
