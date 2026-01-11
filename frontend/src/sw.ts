/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope;

clientsClaim();
cleanupOutdatedCaches();

// VitePWA injectManifest will replace self.__WB_MANIFEST at build time.
precacheAndRoute(self.__WB_MANIFEST);

// Cache images similar to previous workbox runtimeCaching config.
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  })
);

type PushPayload =
  | {
      type: "incoming_call";
      title?: string;
      body?: string;
      callId?: string;
      urgency?: string;
      url?: string;
    }
  | {
      type: "tts_message";
      title?: string;
      body?: string;
      callId?: string;
      url?: string;
    };

self.addEventListener("push", (event) => {
  const data = event.data?.json() as PushPayload | undefined;
  const title = data?.title ?? "cc-caller";
  const body = data?.body ?? "";
  const url = data?.url ?? "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url, callId: data?.callId, type: data?.type },
      tag: data?.callId ? `call-${data.callId}` : undefined,
      renotify: false
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});

