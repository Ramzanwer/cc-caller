import webpush from "web-push";

type PushSubscriptionJSON = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
};

let cachedVapidPublicKey: string | null = null;
let cachedVapidPrivateKey: string | null = null;
let cachedVapidSubject: string | null = null;
let isWebPushConfigured = false;

let currentSubscription: PushSubscriptionJSON | null = null;

function configureWebPushIfPossible(): void {
  if (isWebPushConfigured) return;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  cachedVapidPublicKey = publicKey ?? null;
  cachedVapidPrivateKey = privateKey ?? null;
  cachedVapidSubject = subject ?? null;

  if (!publicKey || !privateKey || !subject) {
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  isWebPushConfigured = true;
}

export function getVapidPublicKey(): string | null {
  configureWebPushIfPossible();
  return cachedVapidPublicKey;
}

export function setPushSubscription(subscription: PushSubscriptionJSON): void {
  currentSubscription = subscription;
}

export async function sendPushNotification(payload: unknown): Promise<void> {
  configureWebPushIfPossible();

  if (!isWebPushConfigured) return;
  if (!currentSubscription) return;

  try {
    await webpush.sendNotification(currentSubscription, JSON.stringify(payload));
  } catch (error) {
    // Reset invalid subscription to avoid repeated failures.
    currentSubscription = null;
    console.error("[Push] Failed to send notification:", error);
  }
}

