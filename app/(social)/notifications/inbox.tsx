"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AtSign, Bell, Heart, MessageCircle, NotebookPen, UserPlus, UserRound } from "lucide-react";
import { api } from "../../lib/api";
import { copy, type Lang } from "../../lib/locale";
import { postPath, profilePath } from "../../lib/paths";
import { readableError, useResource, type NoticeKind } from "../../profile/profile-data";

type Notice = {
  id: number; kind: NoticeKind; actor: string; name: string; username: string; avatar: boolean;
  post_id: string | null; post_username: string | null; profile_mention: boolean; created: number; unread: boolean;
};
type Summary = { unread: number; latest: number | null; sound: boolean };
type Inbox = Summary & { items: Notice[]; more: boolean };

const kinds = {
  follow: { icon: UserPlus, text: "followEvent" },
  wall: { icon: NotebookPen, text: "wallEvent" },
  like: { icon: Heart, text: "likeEvent" },
  reply: { icon: MessageCircle, text: "replyEvent" },
  mention: { icon: AtSign, text: "mentionEvent" },
} as const;

export function useNotificationBadge() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const last = useRef<number | null | undefined>(undefined);
  const audio = useRef<AudioContext | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (!summary?.sound || typeof AudioContext === "undefined") return;
    function unlock() {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume().catch(() => undefined);
      } catch { /* browser does not support sound here */ }
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [summary?.sound]);

  useEffect(() => () => { if (audio.current) void audio.current.close().catch(() => undefined); }, []);
  useEffect(() => {
    let request: AbortController | null = null;
    function refresh() {
      if (document.visibilityState === "hidden") return;
      request?.abort();
      const current = new AbortController();
      request = current;
      api<Summary>("notifications?summary=true", undefined, current.signal).then(next => {
        if (current.signal.aborted) return;
        const context = audio.current;
        if (next.sound && context?.state === "running" && last.current !== undefined
          && next.latest !== null && next.latest > (last.current ?? 0)) {
          const tone = context.createOscillator();
          const level = context.createGain();
          tone.frequency.value = 540;
          level.gain.setValueAtTime(0.035, context.currentTime);
          level.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
          tone.connect(level).connect(context.destination);
          tone.start();
          tone.stop(context.currentTime + 0.2);
        }
        last.current = Math.max(last.current ?? 0, next.latest ?? 0);
        setSummary(next);
      }).catch(() => undefined);
    }
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      request?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [revision]);
  return { count: summary?.unread ?? 0, reload };
}

export function Notifications({ lang, onRead }: {
  lang: Lang; onRead: () => void;
}) {
  const site = copy[lang];
  const t = site.profiles;
  const inbox = useResource<Inbox>("notifications");
  const [additional, setAdditional] = useState<Notice[]>([]);
  const [next, setNext] = useState<boolean | null>(null);
  const [readThrough, setReadThrough] = useState(0);
  const [readAttempt, retryRead] = useState(0);
  const [readError, setReadError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = [...(inbox.data?.items ?? []), ...additional];
  const more = next ?? inbox.data?.more;
  const date = new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" });
  const latest = inbox.data?.latest;

  useEffect(() => {
    if (latest == null || latest <= readThrough) return;
    const through = latest;
    let active = true;
    let sent = false;
    function markRead() {
      if (sent || document.visibilityState !== "visible") return;
      sent = true;
      void api("notifications/read", { through }).then(() => {
        if (!active) return;
        setReadThrough(through);
        onRead();
      }).catch(cause => { if (active) setReadError(cause); });
    }
    document.addEventListener("visibilitychange", markRead);
    markRead();
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", markRead);
    };
  }, [latest, onRead, readAttempt, readThrough]);

  async function act(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await action(); }
    catch (cause) { setError(readableError(lang, cause)); }
    finally { setBusy(false); }
  }

  if (inbox.error) return <div className="inline-state"><p role="alert">{readableError(lang, inbox.error)}</p>
    <button type="button" className="social-secondary" onClick={inbox.reload}>{site.social.retry}</button></div>;
  if (!inbox.data) return <p className="inline-state" role="status">{site.loading}</p>;
  return <section className="notification-list" aria-label={t.notifications}>
    {readError != null && <div className="inline-state">
      <p role="alert">{readableError(lang, readError)}</p>
      <button type="button" className="social-secondary" onClick={() => {
        setReadError(null);
        retryRead(value => value + 1);
      }}>{site.social.retry}</button>
    </div>}
    {error && <p className="social-error" role="alert">{error}</p>}
    {!list.length && <p className="inline-state empty-feed"><Bell size={18} />{t.noticeEmpty}</p>}
    <ul>{list.map(item => {
      const Icon = kinds[item.kind].icon;
      const unread = item.unread && item.id > readThrough;
      const href = item.post_id && item.post_username
        ? postPath(item.post_username, item.post_id)
        : profilePath(item.username);
      return <li key={item.id} data-unread={unread}>
        <Link className="notice-row" href={href}>
          <span className="notice-avatar"><span className="social-avatar">
            {item.avatar ? <img src={`/api/avatars/${item.actor}`} alt="" loading="lazy" /> : <UserRound size={18} />}
          </span><span className="notice-icon"><Icon size={13} /></span></span>
          <span className="notice-text"><span><strong>{item.name}</strong> {item.profile_mention ? t.profileMentionEvent : t[kinds[item.kind].text]}</span>
            <time dateTime={new Date(item.created * 1000).toISOString()}>{date.format(item.created * 1000).toLowerCase()}</time></span>
          {unread && <span className="notice-dot" aria-label={t.unread} />}
        </Link>
      </li>;
    })}</ul>
    {more && <button type="button" className="social-secondary more-posts" disabled={busy} onClick={() => void act(async () => {
      const page = await api<Inbox>(`notifications?before=${list.at(-1)!.id}`);
      setAdditional(old => [...old, ...page.items]);
      setNext(page.more);
    })}>{site.social.more}</button>}
  </section>;
}
