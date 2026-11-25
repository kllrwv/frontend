"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { api } from "../lib/api";
import { copy, type Lang } from "../lib/locale";
import { profilePath } from "../lib/paths";
import { Dialog } from "../ui/dialog";
import { NameWithBadge } from "../ui/verified";
import { connectionCount, readableError, type ConnectionDirection } from "./profile-data";
type Connection = {
  id: string; username: string; name: string; avatar: boolean; verified: boolean;
  mine: boolean; followed: boolean; followers: number;
};
type Page = { accounts: Connection[]; next: string | null };
export function ProfileConnections({ accountId, direction, lang, close, changed }: {
  accountId: string; direction: ConnectionDirection; lang: Lang; close: () => void; changed: () => void;
}) {
  const site = copy[lang];
  const t = site.social;
  const profiles = site.profiles;
  const number = new Intl.NumberFormat(lang);
  const path = `accounts/${accountId}/connections/${direction}`;
  const request = useRef<AbortController | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [loadError, setLoadError] = useState<{ cause: unknown; after: string | null } | null>(null);
  const [actionError, setActionError] = useState("");
  const load = useCallback(async (after: string | null, signal: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await api<Page>(after ? `${path}?after=${encodeURIComponent(after)}` : path, undefined, signal);
      if (signal.aborted) return;
      setPage(current => {
        if (!after || !current) return next;
        const visible = new Set(current.accounts.map(account => account.id));
        return { accounts: [...current.accounts, ...next.accounts.filter(account => !visible.has(account.id))], next: next.next };
      });
    } catch (cause) {
      if (!signal.aborted) setLoadError({ cause, after });
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    void load(null, controller.signal);
    return () => controller.abort();
  }, [load]);
  function loadMore(after: string | null) {
    if (request.current && !loading && !working) void load(after, request.current.signal);
  }
  async function toggle(account: Connection) {
    const signal = request.current?.signal;
    if (!signal || loading || working) return;
    setWorking(true);
    setActionError("");
    try {
      await api(`accounts/${account.id}/follow`, { enabled: !account.followed });
      changed();
      if (!signal.aborted) await load(null, signal);
    } catch (cause) {
      if (!signal.aborted) setActionError(readableError(lang, cause));
    } finally {
      if (!signal.aborted) setWorking(false);
    }
  }
  return <Dialog title={profiles[direction]} close={close} closeLabel={t.close} className="profile-connections">
    <div className="profile-connections-body" aria-busy={loading || working}>
      {actionError && <p className="social-error" role="alert">{actionError}</p>}
      {page && page.accounts.length > 0 && <ul>
        {page.accounts.map(account => <li key={account.id}>
          <Link className="profile-connection-link" href={profilePath(account.username)} onNavigate={close}>
            <span className="social-avatar">{account.avatar ? <img src={`/api/avatars/${account.id}`} alt="" loading="lazy" /> : <UserRound size={20} aria-hidden="true" />}</span>
            <span className="profile-connection-identity">
              <strong>{account.verified ? <NameWithBadge name={account.name} lang={lang} /> : account.name}</strong>
              <small>@{account.username} · {number.format(account.followers)} {connectionCount(lang, "followers", account.followers)}</small>
            </span>
          </Link>
          {!account.mine && <button type="button" className="social-secondary profile-connection-action" disabled={loading || working}
            onClick={() => void toggle(account)}>{account.followed ? t.unfollow : t.follow}</button>}
        </li>)}
      </ul>}
      {loading && <p className="profile-connections-state" role="status">{site.loading}</p>}
      {!loading && !loadError && page?.accounts.length === 0 && <p className="profile-connections-state">{profiles.connectionEmpty[direction]}</p>}
      {loadError && <div className="profile-connections-state">
        <p role="alert">{readableError(lang, loadError.cause)}</p>
        <button type="button" className="social-secondary" onClick={() => loadMore(loadError.after)}>{t.retry}</button>
      </div>}
      {page?.next && !loadError && <div className="profile-connections-state">
        <button type="button" className="social-secondary" disabled={loading || working} onClick={() => loadMore(page.next)}>{t.more}</button>
      </div>}
    </div>
  </Dialog>;
}
