/*
 * Rappel quotidien, côté service worker (chargé par celui que génère Workbox).
 * - « push » : affiche la notification envoyée par le serveur. iOS exige qu'une
 *   notification visible soit affichée à chaque réception.
 * - « notificationclick » : ouvre l'app sur la page Réviser (ou la ramène au premier plan).
 */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Mnémé", {
      body: data.body || "Des fiches t’attendent.",
      icon: "icons/icon-192.png",
      // Un nouveau rappel remplace le précédent au lieu de s'empiler.
      tag: "rappel-quotidien",
      data: { open: data.open || "#reviser" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(self.registration.scope);
  target.hash = (event.notification.data && event.notification.data.open) || "#reviser";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => client.url.startsWith(self.registration.scope));
      if (existing) {
        await existing.focus();
        existing.postMessage({ type: "open", hash: target.hash });
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
