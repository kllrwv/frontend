"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Hash, Search, UserRound } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { copy, type Lang } from "../lib/locale";
import { profilePath, tagPath } from "../lib/paths";
import { Verified } from "../ui/verified";
type Tag = { tag: string; posts: number };
type Person = { id: string; username: string; name: string; avatar: boolean; followed: boolean; mine: boolean; verified?: boolean; deleted?: boolean };
type Results = { tags: Tag[]; people: Person[] };
export function Discovery({ lang, initialQuery }: {
  lang: Lang; initialQuery: string;
}) {
  const site = copy[lang];
  const t = site.social;
  const [query, setQuery] = useState(initialQuery);
  const term = query.trim();
  const [results, setResults] = useState<{ term: string; data: Results } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [revision, refresh] = useState(0);
  const data = results?.term === term ? results.data : null;
  useEffect(() => {
    const request = new AbortController();
    setFailed(null);
    const timer = window.setTimeout(() => {
      api<Results>(`discover?q=${encodeURIComponent(term)}`, undefined, request.signal).then(value => {
        if (!request.signal.aborted) setResults({ term, data: value });
      }).catch(() => { if (!request.signal.aborted) setFailed(term); });
    }, term ? 180 : 0);
    return () => { window.clearTimeout(timer); request.abort(); };
  }, [term, revision]);
  async function toggleFollow(person: Person) {
    if (working) return;
    setWorking(person.id);
    setError("");
    try {
      await api(`accounts/${person.id}/follow`, { enabled: !person.followed });
      setResults(current => current && { ...current, data: { ...current.data,
        people: current.data.people.map(item => item.id === person.id ? { ...item, followed: !person.followed } : item) } });
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.message : "unavailable";
      setError(site.errors[code as keyof typeof site.errors] ?? site.errors.unavailable);
    } finally { setWorking(null); }
  }
  return <>
    <label className="discovery-input">
      <Search size={20} aria-hidden="true" />
      <span className="sr-only">{t.searchPlaceholder}</span>
      <input type="search" value={query} maxLength={100} placeholder={t.searchPlaceholder}
        onChange={event => {
          const value = event.target.value;
          setQuery(value);
          setError("");
          const url = new URL(window.location.href);
          if (value.trim()) url.searchParams.set("q", value.trim());
          else url.searchParams.delete("q");
          window.history.replaceState(null, "", url);
        }} />
    </label>
    {error && <p className="social-error" role="alert">{error}</p>}
    {failed === term ? <div className="inline-state">
      <p role="alert">{site.errors.unavailable}</p>
      <button type="button" className="social-secondary" onClick={() => refresh(value => value + 1)}>{t.retry}</button>
    </div> : !data ? <p className="inline-state" role="status">{site.loading}</p> : <>
      {data.people.length > 0 && <section className="discovery-section">
        <h2>{t.people}</h2>
        <ul>{data.people.map(person => <li key={person.id} className="discovery-person">
          <span className="social-avatar">{person.avatar ? <img src={`/api/avatars/${person.id}`} alt="" /> : <UserRound size={19} />}</span>
          <div><span className="verified-name"><Link className="profile-author-link" href={profilePath(person.username)}>{person.name}</Link>
            {person.verified && <Verified lang={lang} />}</span><span>@{person.username}</span>
            {person.deleted && <small className="removed-caption">{site.admin.deletedAccount}</small>}</div>
          {!person.mine && !person.deleted && <button className="social-secondary" type="button" disabled={working !== null}
            aria-pressed={person.followed} onClick={() => void toggleFollow(person)}>
            {person.followed ? t.unfollow : t.follow}</button>}
        </li>)}</ul>
      </section>}
      {(!term || data.tags.length > 0) && <section className="discovery-section">
        <h2>{term ? t.tags : t.popularTags}</h2>
        {data.tags.length ? <ul>{data.tags.map(({ tag, posts }) => <li key={tag}>
          <Link className="discovery-tag" href={tagPath(tag)}>
            <span className="tag-mark"><Hash size={20} aria-hidden="true" /></span>
            <span className="tag-text"><strong>#{tag}</strong>
              <small>{t.postCount.replace("{count}", new Intl.NumberFormat(lang).format(posts))}</small></span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </li>)}</ul> : <p className="inline-state">{t.tagsEmpty}</p>}
      </section>}
      {term && !data.people.length && !data.tags.length && <p className="inline-state">{t.discoveryEmpty}</p>}
    </>}
  </>;
}
