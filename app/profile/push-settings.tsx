"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { copy, type Lang } from "../lib/locale";
import { readableError, useResource } from "./profile-data";
const kinds = ["activity", "following", "recommendations", "reminders"] as const;
type Kind = (typeof kinds)[number];
type Device = { public_key: string | null; connected: boolean; preferences: Record<Kind, boolean> };
type Support = "checking" | "ready" | "install" | "unsupported" | "failed";
export function PushSettings({ lang, notificationsEnabled }: { lang: Lang; notificationsEnabled: boolean }) {
  const site = copy[lang];
  const t = site.profiles.push;
  const device = useResource<Device>("push");
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [support, setSupport] = useState<Support>("checking");
  const [browserSubscription, setBrowserSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [checking, setChecking] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const installed = matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (ios && !installed) { setSupport("install"); return; }
    if (!("serviceWorker" in navigator && "PushManager" in window && "Notification" in window)) {
      setSupport("unsupported"); return;
    }
    let active = true;
    setSupport("checking");
    setPermission(Notification.permission);
    function refreshPermission() { setPermission(Notification.permission); }
    window.addEventListener("focus", refreshPermission);
    navigator.serviceWorker.register("/push-worker.js").then(() => navigator.serviceWorker.ready).then(async worker => {
      const subscription = await worker.pushManager.getSubscription();
      if (!active) return;
      setRegistration(worker);
      setBrowserSubscription(subscription);
      setSupport("ready");
    }).catch(() => { if (active) setSupport("failed"); });
    return () => { active = false; window.removeEventListener("focus", refreshPermission); };
  }, [checking]);
  async function perform(action: () => Promise<void>, success = site.profiles.saved) {
    if (busy) return;
    setBusy(true);
    setError("");
    setFeedback("");
    try { await action(); setFeedback(success); }
    catch (cause) {
      if ("Notification" in window && Notification.permission === "denied") setError(t.denied);
      else setError(readableError(lang, cause));
    } finally {
      if ("Notification" in window) setPermission(Notification.permission);
      setBusy(false);
    }
  }
  function enable() {
    if (!registration || !device.data?.public_key || busy) return;
    const raw = device.data.public_key.replace(/-/g, "+").replace(/_/g, "/");
    const key = Uint8Array.from(atob(raw), character => character.charCodeAt(0));
    const subscribing = registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    void perform(async () => {
      const subscription = await subscribing;
      setBrowserSubscription(subscription);
      await api("push/subscribe", { ...subscription.toJSON(), lang });
      device.reload();
    });
  }
  function disable() {
    void perform(async () => {
      await api("push/unsubscribe", {});
      device.reload();
      if (browserSubscription) await browserSubscription.unsubscribe().catch(() => false);
      setBrowserSubscription(null);
    });
  }
  const connected = !!(device.data?.connected && browserSubscription && permission === "granted");
  return <section className="settings-push settings-stack" aria-label={t.title}>
    <h4>{t.title}</h4>
    <p className="settings-push-hint">{t.hint}</p>
    {support === "install" && <p className="settings-push-hint">{t.install}</p>}
    {support === "unsupported" && <p className="settings-push-hint">{t.unsupported}</p>}
    {support === "failed" && <div className="settings-stack">
      <p className="social-error" role="alert">{site.errors.unavailable}</p>
      <button type="button" className="social-secondary" onClick={() => setChecking(value => value + 1)}>{site.social.retry}</button>
    </div>}
    {device.error ? <div className="settings-stack">
      <p className="social-error" role="alert">{readableError(lang, device.error)}</p>
      <button type="button" className="social-secondary" onClick={device.reload}>{site.social.retry}</button>
    </div> : !device.data || support === "checking" ? <p role="status">{site.loading}</p> : <>
      {support === "ready" && <>
        {!device.data.public_key && <p className="settings-push-hint">{t.unavailable}</p>}
        {permission === "denied" && <p className="settings-push-hint">{t.denied}</p>}
        {connected && <p className="settings-push-hint">{t.connected}</p>}
        <div className="settings-push-actions">
          {!connected && device.data.public_key && permission !== "denied" &&
            <button type="button" className="social-primary" disabled={busy} onClick={enable}>{t.enable}</button>}
          {device.data.connected && <button type="button" className="social-secondary" disabled={busy} onClick={disable}>{t.disable}</button>}
          {connected && device.data.public_key && <button type="button" className="social-secondary" disabled={busy}
            onClick={() => void perform(() => api("push/test", {}), t.testQueued)}>{t.test}</button>}
        </div>
      </>}
      {kinds.map(kind => <label className="settings-row" key={kind}>
        <div><strong>{t.kinds[kind].title}</strong><p>{t.kinds[kind].hint}</p></div>
        <input type="checkbox" role="switch" checked={device.data?.preferences[kind] ?? false} disabled={busy || !notificationsEnabled}
          onChange={event => {
            const enabled = event.target.checked;
            void perform(async () => { await api("push/preferences", { kind, enabled }); device.reload(); });
          }} />
      </label>)}
    </>}
    {error && <p className="social-error" role="alert">{error}</p>}
    {feedback && <p className="settings-feedback" role="status">{feedback}</p>}
  </section>;
}
