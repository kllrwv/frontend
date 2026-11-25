self.addEventListener("push", event => {
  let data;
  try { data = event.data?.json(); } catch { data = null; }
  const title = typeof data?.title === "string" ? data.title : "killerwave";
  event.waitUntil(self.registration.showNotification(title, {
    body: data?.body,
    icon: "/app-icon-192.png",
    tag: data?.tag,
    lang: data?.lang,
    timestamp: Number.isFinite(data?.timestamp) ? data.timestamp * 1000 : Date.now(),
    silent: data?.silent ?? false,
    data: { url: data?.url },
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const fallback = new URL("/notifications", self.location.origin);
    let target;
    try { target = new URL(event.notification.data?.url ?? fallback.href, self.location.origin); } catch { target = fallback; }
    if (target.origin !== self.location.origin || !/^https?:$/.test(target.protocol)) target = fallback;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => client.url === target.href) ?? windows[0];
    if (existing) {
      try {
        const client = existing.url === target.href ? existing : await existing.navigate(target.href);
        if (client) { await client.focus(); return; }
      } catch {}
    }
    await self.clients.openWindow(target.href);
  })());
});
self.addEventListener("pushsubscriptionchange", event => {
  if (!event.newSubscription) return;
  event.waitUntil((async () => {
    const response = await fetch("/api/push", { cache: "no-store" });
    if (!response.ok) return;
    const { connected, lang, public_key: publicKey } = await response.json();
    if (!connected || !lang || !publicKey) return;
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...event.newSubscription.toJSON(), lang }),
    });
  })());
});
