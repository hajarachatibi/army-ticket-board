// Web Push service worker (no Firebase). Handles push events and shows notifications.
self.addEventListener("push", function (event) {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "ARMY Ticket Board", body: event.data.text() || "New notification" };
  }
  const title = payload.title || "ARMY Ticket Board";
  const body = payload.body || "";
  const options = {
    body: body,
    icon: "/army-ticket-board-logo.png",
    data: payload,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const data = event.notification.data || {};
  const url = "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
