import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { copy, type Lang } from "../lib/locale";
export type Theme = "dark" | "light" | "system";
export type Audience = "everyone" | "followers" | "nobody";
export type NoticeKind = "follow" | "wall" | "like" | "reply" | "mention";
export type NoticePreference = NoticeKind | "all" | "sound" | "messages";
export type Owner = { username: string | null; display_name: string | null; bio: string; has_avatar: boolean };
export type ProfileView = {
  id: string; username: string; name: string; bio: string; avatar: boolean; banner: string | null;
  verified?: boolean; deleted?: boolean; mine: boolean; followed: boolean; following: number; followers: number; joined: number;
  aliases?: string[];
  last_seen: number | null; can_write: boolean; can_see_likes: boolean; theme: Theme | null;
};
export type Preferences = {
  theme: Theme; wall_access: Audience; like_access: Audience; message_access: Audience; show_online: boolean;
  notice_preferences: Partial<Record<NoticePreference, boolean>>;
};
export type Blocked = { id: string; name: string; username: string };
export type ConnectionDirection = "followers" | "following";
export function connectionCount(lang: Lang, direction: ConnectionDirection, count: number) {
  const plural = new Intl.PluralRules(lang).select(count);
  const labels = copy[lang].profiles.connectionCounts[direction];
  return labels[plural === "one" || plural === "few" ? plural : "other"];
}
export function readableError(lang: Lang, cause: unknown) {
  const errors = copy[lang].errors;
  return (cause instanceof ApiError && errors[cause.message as keyof typeof errors]) || errors.unavailable;
}
export function useResource<T>(path: string | null) {
  const [response, setResponse] = useState<{ path: string; data: T } | null>(null);
  const [failure, setFailure] = useState<{ path: string; cause: unknown } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!path) return;
    const request = new AbortController();
    setFailure(null);
    api<T>(path, undefined, request.signal).then(data => {
      if (!request.signal.aborted) setResponse({ path, data });
    }).catch(cause => {
      if (!request.signal.aborted) setFailure({ path, cause });
    });
    return () => request.abort();
  }, [path, revision]);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  return {
    data: response?.path === path ? response?.data : undefined,
    error: failure?.path === path ? failure?.cause : undefined,
    reload,
  };
}
