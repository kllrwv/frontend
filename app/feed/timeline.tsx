"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, ArrowDownLeft, ArrowLeft, ArrowUpRight, Bell, LayoutList, LogOut, Search, UserRound } from "lucide-react";
import { useSession } from "../(social)/session";
import { ServiceLinks } from "../legal/links";
import { api } from "../lib/api";
import { type Access } from "../ui/moderation";
import { Dialog } from "../ui/dialog";
import { Discovery } from "./discovery";
import { copy } from "../lib/locale";
import { Notifications, useNotificationBadge } from "../(social)/notifications/inbox";
import { postPath, profilePath } from "../lib/paths";
import { useResource, type ProfileView } from "../profile/profile-data";
import { ProfileHead } from "../profile/profile-screen";
import { ProfileSettings } from "../profile/profile-settings";
import { Discussion } from "./discussion";
import { errorText, useFeed, type Post } from "./post-data";
import { Composer, PostCard, RepostEditor } from "./posts";

type Screen =
  | { view: "feed" }
  | { view: "search"; query: string }
  | { view: "tag"; tag: string }
  | { view: "notifications" }
  | { view: "profile"; handle: string; legacy?: boolean }
  | { view: "post"; handle: string; id: string };

export function Timeline({ screen }: { screen: Screen }) {
  const session = useSession();
  const { lang } = session;
  const site = copy[lang];
  const t = site.social;
  const p = site.profiles;
  const router = useRouter();
  const [feedMode, setFeedMode] = useState<"recommended" | "following">("recommended");
  const [likes, setLikes] = useState(false);
  const [editing, setEditing] = useState(false);
  const [avatarRevision, setAvatarRevision] = useState(0);
  const [dialog, setDialog] = useState<{ type: "repost" | "delete"; post: Post } | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const seen = useRef(new Set<string>());
  const selectingFeed = screen.view === "feed";
  const viewedProfile = screen.view === "profile" ? screen : null;
  const selectedPost = screen.view === "post" ? screen : null;
  const profile = useResource<ProfileView>(viewedProfile
    ? `profiles/${encodeURIComponent(viewedProfile.legacy ? viewedProfile.handle : `@${viewedProfile.handle}`)}` : null);
  const detail = useResource<Post>(selectedPost ? `posts/${selectedPost.id}` : null);
  const user = profile.data;
  const post = detail.data;
  const currentLikes = likes && !!user?.can_see_likes;
  const query = selectingFeed ? `mode=${feedMode}` : screen.view === "tag" ? `tag=${encodeURIComponent(screen.tag)}` :
    viewedProfile && user ? `profile=${user.id}&likes=${currentLikes}` : null;
  const feed = useFeed(query);
  const hasFollowingPosts = feed.hasFollowingPosts;
  const badge = useNotificationBadge();
  const access = useResource<Access>("mod/access").data;

  useEffect(() => {
    if (feedMode === "following" && hasFollowingPosts === false) setFeedMode("recommended");
  }, [feedMode, hasFollowingPosts]);

  const canonicalProfile = viewedProfile && user && (viewedProfile.legacy || user.username !== viewedProfile.handle)
    ? profilePath(user.username) : null;
  const canonicalPost = selectedPost && post && (post.author.username !== selectedPost.handle || post.id !== selectedPost.id)
    ? postPath(post.author.username, post.id) : null;
  const canonical = canonicalProfile ?? canonicalPost;
  useEffect(() => {
    if (canonical) router.replace(canonical, { scroll: false });
  }, [canonical, router]);

  async function change(action: () => Promise<unknown>, done: () => void) {
    if (working) return;
    setWorking(true);
    setError("");
    try { await action(); done(); }
    catch (cause) { setError(errorText(lang, cause)); }
    finally { setWorking(false); }
  }

  function recordView(id: string) {
    if (seen.current.has(id)) return;
    seen.current.add(id);
    void api<number>(`posts/${id}/view`, {}).then(views => {
      if (selectedPost) detail.reload();
      else feed.update(item => item.id === id ? { ...item, views: Math.max(item.views, views) } : item);
    }).catch(() => seen.current.delete(id));
  }

  function renderPost(item: Post, isDetail = false) {
    return <PostCard key={item.id} post={item} lang={lang} detail={isDetail} disabled={working} onView={recordView} moderated={isDetail ? detail.reload : feed.reload}
      onVote={value => {
        if (isDetail) detail.reload();
        else feed.update(previous => previous.id === item.id ? { ...previous, poll: value } : previous);
      }}
      toggleLike={() => void change(() => api(`posts/${item.id}/like`, { enabled: !item.liked }), () => {
        if (isDetail) detail.reload();
        else {
          feed.update(previous => previous.id === item.id
            ? { ...previous, liked: !item.liked, likes: previous.likes + (item.liked ? -1 : 1) } : previous);
          if (currentLikes && user?.mine) feed.reload();
        }
      })}
      toggleFollow={() => void change(() => api(`accounts/${item.author.id}/follow`, { enabled: !item.followed }),
        isDetail ? detail.reload : feed.reload)}
      quote={() => setDialog({ type: "repost", post: item })}
      remove={() => { setError(""); setDialog({ type: "delete", post: item }); }} />;
  }

  const heading = screen.view === "tag" ? `#${screen.tag}` : screen.view === "search" ? t.search :
    screen.view === "notifications" ? p.notifications : screen.view === "post" ? t.postTitle : site.feed;
  const statusLinks = <>
    {access?.origin && <a href="/api/admin/session/start">{site.admin.title}<ArrowUpRight size={14} /></a>}
    <Link href="/status"><Activity size={17} />{t.status}<ArrowUpRight size={14} aria-hidden="true" /></Link>
    <ServiceLinks lang={lang} />
  </>;

  return <main className="social-shell" data-theme={session.theme}>
    <aside className="social-side">
      <Link href="/" className="social-wordmark"><img src="/logo.svg" alt="" width={29} height={29} /><span>{site.feedBrand}</span></Link>
      <nav className="social-nav" aria-label={t.navigation}>
        <Link href="/" aria-current={selectingFeed ? "page" : undefined}><LayoutList size={20} aria-hidden="true" /><span>{site.feed}</span></Link>
        <Link href="/search" aria-current={screen.view === "search" || screen.view === "tag" ? "page" : undefined}><Search size={20} aria-hidden="true" /><span>{t.search}</span></Link>
        <Link href="/notifications" aria-current={screen.view === "notifications" ? "page" : undefined}>
          <Bell size={20} aria-hidden="true" /><span>{p.notifications}</span>{badge.count > 0 && <small className="notice-count">{badge.count > 99 ? "99+" : badge.count}</small>}
        </Link>
        <Link href={profilePath(session.profile.username)} aria-current={viewedProfile && user?.mine ? "page" : undefined}>
          <UserRound size={20} aria-hidden="true" /><span>{p.profile}</span></Link>
      </nav>
      <div className="social-side-footer">
        {session.languagePicker}
        <button type="button" className="sign-out" onClick={session.signOut} disabled={session.signingOut}>
          <LogOut size={18} /><span>{site.logout}</span>
        </button>
        {session.signOutError && <p className="social-error" role="alert">{session.signOutError}</p>}
      </div>
    </aside>
    <section className="social-main" tabIndex={0} aria-label={viewedProfile ? p.profile : heading}>
      {!viewedProfile && <header className={selectedPost ? "social-heading post-page-heading" : "social-heading"}>
        {screen.view === "tag" && <Link href="/search" className="tag-back"><ArrowLeft size={17} />{t.backToSearch}</Link>}
        {selectedPost && <Link href="/" className="icon-action post-back" aria-label={t.backToFeed} title={t.backToFeed}>
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>}
        <h1>{heading}</h1>
        {selectingFeed && <nav className="feed-switch" aria-label={site.feed}>
          <button type="button" aria-pressed={feedMode === "recommended"} onClick={() => setFeedMode("recommended")}>{t.forYou}</button>
          {hasFollowingPosts && <button type="button" aria-pressed={feedMode === "following"} onClick={() => setFeedMode("following")}>{t.following}</button>}
        </nav>}
      </header>}
      {screen.view === "search" && <Discovery key={screen.query} lang={lang} initialQuery={screen.query} />}
      {screen.view === "notifications" && <Notifications lang={lang} onRead={badge.reload} />}
      {viewedProfile && (profile.error ? <div className="inline-state">
        <p role="alert">{errorText(lang, profile.error)}</p>
        <button type="button" className="social-secondary" onClick={profile.reload}>{t.retry}</button>
      </div> : !user ? <p className="inline-state" role="status">{site.loading}</p> : <>
        <ProfileHead key={user.id} lang={lang} data={user} revision={avatarRevision} edit={() => setEditing(true)}
          access={access} changed={() => { profile.reload(); feed.reload(); }} blocked={() => { badge.reload(); router.push("/search"); }} />
        <nav className="feed-switch profile-switch" aria-label={p.profile}>
          <button type="button" aria-pressed={!currentLikes} onClick={() => setLikes(false)}>{p.wallPosts}</button>
          {user.can_see_likes && <button type="button" aria-pressed={currentLikes} onClick={() => setLikes(true)}>{p.likedPosts}</button>}
        </nav>
        {editing && user.mine && <ProfileSettings user={user} lang={lang} revision={avatarRevision} close={() => setEditing(false)}
          saved={value => {
            session.profileSaved(value);
            setAvatarRevision(rev => rev + 1);
            if (value.username && value.username !== user.username) router.replace(profilePath(value.username));
            else { profile.reload(); feed.reload(); }
          }}
          refreshProfile={() => { profile.reload(); badge.reload(); }} themeChanged={session.themeChanged} deleted={() => {
            session.profileSaved(null);
            router.replace("/");
          }} />}
      </>)}
      {(selectingFeed || (viewedProfile && user?.can_write && !currentLikes)) && <Composer key={user?.id ?? "feed"}
        lang={lang} hasAvatar={session.profile.has_avatar} avatarRevision={avatarRevision}
        wall={viewedProfile && !user?.mine ? user?.id : undefined}
        onPublish={() => { feed.reload(); if (viewedProfile) profile.reload(); }} />}
      {error && !dialog && <p className="social-error" role="alert">{error}</p>}
      {selectedPost && (detail.error ? <div className="inline-state">
        <p role="alert">{errorText(lang, detail.error)}</p>
        <button type="button" className="social-secondary" onClick={detail.reload}>{t.retry}</button>
      </div> : !post ? <p className="inline-state" role="status">{site.loading}</p> : <div className="post-detail">
        {renderPost(post, true)}
        <Discussion key={`discussion-${post.id}`} postId={post.id} readOnly={post.deleted} lang={lang} onPublished={detail.reload} />
      </div>)}
      {query && feed.error != null && <div className="social-card inline-state">
        <p role="alert">{errorText(lang, feed.error)}</p>
        <button type="button" className="social-secondary" onClick={feed.reload}>{t.retry}</button>
      </div>}
      {query && !feed.current && feed.error == null && <p className="inline-state" role="status">{site.loading}</p>}
      {feedMode !== "following" && feed.current?.posts.length === 0 && <p className="inline-state empty-feed">
        <ArrowDownLeft size={20} aria-hidden="true" />
        {screen.view === "tag" ? t.tagPostsEmpty : viewedProfile ? (currentLikes ? p.likesEmpty : p.wallEmpty) : t.emptyFeed}
      </p>}
      {feed.current?.posts.length ? <div className="timeline-posts">{feed.current.posts.map(item => renderPost(item))}</div> : null}
      {feed.current?.more && <button type="button" className="social-secondary more-posts" onClick={feed.more} disabled={feed.loadingMore}>{t.more}</button>}
      <footer className="social-status-link social-status-inline">{statusLinks}</footer>
    </section>
    <aside className="social-status-link social-status-side">{statusLinks}</aside>
    {dialog && (dialog.type === "delete"
      ? <Dialog title={t.confirmDelete} close={() => setDialog(null)} closeLabel={t.close}>
        {error && <p className="social-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="social-secondary" onClick={() => setDialog(null)}>{t.cancel}</button>
          <button type="button" className="social-primary danger-action" disabled={working} onClick={() => void change(
            () => api(`posts/${dialog.post.id}/delete`, {}), () => {
              setDialog(null);
              if (selectedPost) router.replace("/");
              else feed.reload();
            },
          )}>{t.deletePost}</button>
        </div>
      </Dialog>
      : <RepostEditor post={dialog.post} lang={lang} submitted={selectedPost ? detail.reload : feed.reload} close={() => setDialog(null)} />)}
  </main>;
}
