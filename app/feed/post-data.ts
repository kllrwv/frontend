"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { copy, type Lang } from "../lib/locale";
import type { Attachment } from "./media-player";
import type { Poll, PollDraft } from "./poll";

export type Author = { id: string; name: string; username: string; avatar: boolean; verified?: boolean };
export type Preview = { id: string; author: Author; body: string; image: boolean; media?: Attachment[]; poll: Poll | null };
export type Post = Preview & {
  created_at: number; likes: number; replies: number; reposts: number; views: number;
  mine: boolean; deleted?: boolean; can_moderate?: boolean; poll_deleted?: boolean; can_delete?: boolean; wall?: boolean; liked: boolean; reposted: boolean; followed: boolean;
  is_repost: boolean; original: Preview | null;
};
type FeedPage = { posts: Post[]; more: boolean; has_following_posts?: boolean };
type State = FeedPage & { key: string; offset: number };

export function errorText(lang: Lang, error: unknown) {
  const errors = copy[lang].errors;
  return error instanceof ApiError ? errors[error.message as keyof typeof errors] ?? errors.invalid : errors.unavailable;
}

export function useFeed(query: string | null) {
  const [snapshot, setSnapshot] = useState<State | null>(null);
  const [revision, reload] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const current = snapshot?.key === query ? snapshot : null;

  useEffect(() => {
    if (query === null) return;
    const request = new AbortController();
    setError(null);
    api<FeedPage>(`feed?${query}`, undefined, request.signal)
      .then((value) => { if (!request.signal.aborted) setSnapshot({ ...value, key: query, offset: 20 }); })
      .catch((error) => { if (!request.signal.aborted) setError(error); });
    return () => request.abort();
  }, [query, revision]);

  async function more() {
    if (query === null || !current?.more || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const value = await api<FeedPage>(`feed?${query}&offset=${current.offset}`);
      setSnapshot((previous) => {
        if (!previous || previous.key !== query || previous.offset !== current.offset) return previous;
        const seen = new Set(previous.posts.map((post) => post.id));
        return { ...previous, offset: previous.offset + 20, more: value.more,
          posts: [...previous.posts, ...value.posts.filter((post) => !seen.has(post.id))] };
      });
    } catch (error) { setError(error); }
    finally { setLoadingMore(false); }
  }

  function update(transform: (post: Post) => Post) {
    setSnapshot((before) => before && { ...before, posts: before.posts.map(transform) });
  }

  return {
    current, error, more, loadingMore, hasFollowingPosts: snapshot?.has_following_posts,
    reload: () => reload((value) => value + 1), update,
  };
}

export async function publish(body: string, id: string, options: { media?: File[]; poll?: PollDraft | null; wall?: string; reply?: string; repost?: string } = {}) {
  const form = new FormData();
  form.set("body", body);
  form.set("id", id);
  for (const file of options.media ?? []) form.append("media", file);
  if (options.poll) form.set("poll", JSON.stringify(options.poll));
  if (options.wall) form.set("wall", options.wall);
  if (options.reply) form.set("reply_to", options.reply);
  if (options.repost) form.set("repost_of", options.repost);
  await api("posts", form);
}
