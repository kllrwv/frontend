"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChartNoAxesColumn, Ellipsis, Eye, Heart, MessageCircle, Palette, Paperclip, Repeat2, UserRound } from "lucide-react";
import { ContentDialog, targetsFor, type Mode } from "../ui/moderation";
import { NameWithBadge } from "../ui/verified";
import { Dialog } from "../ui/dialog";
import { Drawing } from "./drawing";
import { copy, type Lang } from "../lib/locale";
import { LinkedText, MentionField } from "../ui/mentions";
import { DraftAttachment, PostAttachments, fileAccept, validAttachments } from "./media-player";
import { PollCard, PollEditor, initialPoll, validPoll, type Poll, type PollDraft } from "./poll";
import { postPath, profilePath } from "../lib/paths";
import { errorText, publish, type Author, type Post, type Preview } from "./post-data";
export function Avatar({ source }: { source?: string }) {
  return <span className="social-avatar">{source ? <img src={source} alt="" loading="lazy" /> : <UserRound size={20} strokeWidth={1.6} />}</span>;
}
export function PostImage({ id, label }: { id: string; label: string }) {
  return <img className="post-image" src={`/api/posts/${id}/image`} alt={label} loading="lazy" decoding="async" />;
}
export function AuthorLine({ author, lang }: { author: Author; lang: Lang }) {
  return <div className="post-author">
    <Link className="profile-author-link" href={profilePath(author.username)}>
      {author.verified ? <NameWithBadge name={author.name} lang={lang} /> : author.name}
    </Link>
    <span>@{author.username}</span>
  </div>;
}
function Quote({ post, lang }: { post: Preview | null; lang: Lang }) {
  const t = copy[lang].social;
  if (!post) return <div className="post-quote unavailable-quote">{t.originalUnavailable}</div>;
  return <div className="post-quote">
    <header>
      <Avatar source={post.author.avatar ? `/api/avatars/${post.author.id}` : undefined} />
      <AuthorLine author={post.author} lang={lang} />
      <Link className="quote-open" href={postPath(post.author.username, post.id)} aria-label={t.openPost}>
        <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </header>
    {post.body && <p className="post-body"><LinkedText value={post.body} /></p>}
    {post.image && <PostImage id={post.id} label={t.imageAlt} />}
    <PostAttachments id={post.id} media={post.media ?? []} lang={lang} />
    {post.poll && <PollCard id={post.id} lang={lang} value={post.poll} />}
  </div>;
}
export function PostCard({ post, lang, toggleLike, toggleFollow, quote, detail = false, remove, onView, disabled, onVote, moderated }: {
  post: Post; lang: Lang; toggleLike: () => void; toggleFollow: () => void;
  quote: () => void; detail?: boolean; remove: () => void; onView?: (id: string) => void; disabled: boolean;
  onVote: (value: Poll) => void; moderated: () => void;
}) {
  const element = useRef<HTMLElement>(null);
  const [moderation,setModeration]=useState<Mode | null>(null);
  const mod=copy[lang].admin;
  const router = useRouter();
  const t = copy[lang].social;
  const href = postPath(post.author.username, post.id);
  const observe = useRef(onView);
  useEffect(() => { observe.current = onView; }, [onView]);
  useEffect(() => {
    if (!element.current || !observe.current || post.deleted) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observe.current?.(post.id);
      observer.disconnect();
    }, { threshold: .3 });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [post.id,post.deleted]);
  const date = new Date(post.created_at * 1000);
  const formatted = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date).toLowerCase();
  return <article className="post-card" data-openable={!detail} data-detail={detail} ref={element} onClick={detail ? undefined : event => {
    if (event.defaultPrevented || !(event.target instanceof Element)
      || event.target.closest("a,button,input,textarea,select,summary,audio,video,label")
      || window.getSelection()?.type === "Range") return;
    router.push(href);
  }}>
    {post.is_repost && <div className="repost-label"><Repeat2 size={14} />{t.repost}</div>}
    <header className="post-head">
      <Avatar source={post.author.avatar ? `/api/avatars/${post.author.id}` : undefined} />
      <div className="post-byline">
        <AuthorLine author={post.author} lang={lang} />
        {detail ? <time dateTime={date.toISOString()}>{formatted}</time>
          : <Link className="post-date-link" href={href} aria-label={t.openPost}><time dateTime={date.toISOString()}>{formatted}</time></Link>}
      </div>
      {!post.deleted && <details className="post-menu">
        <summary className="icon-action" aria-label={t.postOptions}><Ellipsis size={20} /></summary>
        <div>
          <button type="button" className={post.mine || post.can_delete ? "danger-action" : undefined} disabled={disabled} onClick={(event) => {
            event.currentTarget.closest("details")?.removeAttribute("open");
            if (post.mine || post.can_delete) remove();
            else toggleFollow();
          }}>{post.mine || post.can_delete ? t.deletePost : post.followed ? t.unfollow : t.follow}</button>
          {!post.mine && <button type="button" className="danger-action" onClick={event => {
            event.currentTarget.closest("details")?.removeAttribute("open"); setModeration("report");
          }}>{mod.fileReport}</button>}
          {post.can_moderate && <button type="button" className="danger-action" onClick={event => {
            event.currentTarget.closest("details")?.removeAttribute("open"); setModeration("remove");
          }}>{mod.moderate}</button>}
        </div>
      </details>}
    </header>
    {post.body && <p className="post-body"><LinkedText value={post.body} linkTags /></p>}
    {post.image && <PostImage id={post.id} label={t.imageAlt} />}
    <PostAttachments id={post.id} media={post.media ?? []} lang={lang} />
    {post.poll && <PollCard id={post.id} lang={lang} value={post.poll} interactive={!post.deleted && !post.poll_deleted} updated={onVote} />}
    {post.is_repost && <Quote post={post.original} lang={lang} />}
    {post.poll_deleted && <p className="removed-caption">{mod.deletedPoll}</p>}
    {post.deleted && <p className="removed-caption">{mod.deletedPost}</p>}
    {moderation && (moderation === "remove" || !post.mine) && <ContentDialog targets={targetsFor(post)} lang={lang} mode={moderation}
      close={() => setModeration(null)} changed={moderated}/>}
    <footer className="post-actions">
      <button type="button" className="reaction" aria-label={post.liked ? t.unlike : t.like} aria-pressed={post.liked}
        onClick={toggleLike} disabled={disabled || post.deleted}><Heart size={19} />{post.likes}</button>
      <Link className="reaction" href={detail ? "#comments" : href} aria-label={t.comments}>
        <MessageCircle size={18} />{post.replies}</Link>
      {!post.wall && <button type="button" className="reaction" aria-label={post.reposted ? t.repostDone : t.repost} disabled={post.reposted || post.deleted}
        onClick={quote}><Repeat2 size={19} />{post.reposts}</button>}
      <span className="reaction view-count" title={t.views}><Eye size={18} /><span className="sr-only">{t.views}</span>{post.views}</span>
    </footer>
  </article>;
}
export function RepostEditor({ post, lang, submitted, close }: {
  post: Post; lang: Lang; submitted: () => void; close: () => void;
}) {
  const t = copy[lang].social;
  const id = useRef("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      id.current ||= crypto.randomUUID();
      await publish(body, id.current, { repost: post.id });
      submitted();
      close();
    } catch (error) { setError(errorText(lang, error)); }
    finally { setBusy(false); }
  }
  return <Dialog title={t.repost} close={close} closeLabel={t.close}>
    <Quote post={post} lang={lang} />
    <form className="response-form" onSubmit={submit}>
      <MentionField className="response-field" lang={lang} label={t.repostHint} autoGrow
        maxLength={1000} rows={3} value={body} disabled={busy}
        onChange={value => { id.current = ""; setBody(value); }} />
      {error && <p className="social-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="social-secondary" onClick={close}>{t.cancel}</button>
        <button className="social-primary" disabled={busy}>{t.repostVerb}</button>
      </div>
    </form>
  </Dialog>;
}
export function Composer({ lang, hasAvatar, onPublish, wall, avatarRevision }: { lang: Lang; hasAvatar: boolean; onPublish: () => void; wall?: string; avatarRevision: number }) {
  const t = copy[lang].social;
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [poll, setPoll] = useState<PollDraft | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const id = useRef("");
  const ready = (body.trim() || attachments.length > 0 || poll) && (!poll || validPoll(poll));
  function attach(files: File[]) {
    if (!validAttachments(files)) {
      setError(copy[lang].errors.post_media_invalid);
      return;
    }
    setError("");
    id.current = "";
    setAttachments(files);
  }
  function changePoll(draft: PollDraft | null) {
    id.current = "";
    setPoll(draft);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending || !ready) return;
    setSending(true);
    setError("");
    try {
      id.current ||= crypto.randomUUID();
      await publish(body, id.current, { media: attachments, poll, wall });
      setBody("");
      attach([]);
      setPoll(null);
      onPublish();
    } catch (error) { setError(errorText(lang, error)); }
    finally { setSending(false); }
  }
  return <form className="social-card composer" onSubmit={submit}>
    <div className="composer-line">
      <Avatar source={hasAvatar ? `/api/profile/avatar?v=${avatarRevision}` : undefined} />
      <MentionField className="composer-field" lang={lang} label={wall ? copy[lang].profiles.wallComposer : t.composer} placeholderOnly autoGrow
        value={body} rows={2} maxLength={1000} disabled={sending}
        onChange={value => { id.current = ""; setBody(value); }} />
    </div>
    {attachments.length > 0 && <div className="draft-attachments">{attachments.map((file, index) =>
      <DraftAttachment key={`${file.name}-${index}`} file={file} lang={lang} disabled={sending}
        remove={() => attach(attachments.filter((_, position) => position !== index))} />)}</div>}
    {poll && <PollEditor value={poll} onChange={changePoll} remove={() => changePoll(null)} lang={lang} disabled={sending} />}
    {error && <p className="social-error" role="alert">{error}</p>}
    <div className="composer-tools">
      <label className="icon-action attach-file" title={t.attach}>
        <Paperclip size={20} />
        <input type="file" aria-label={t.attach} disabled={sending || attachments.length >= 4} accept={fileAccept} multiple onChange={(event) => {
          if (event.currentTarget.files?.length) attach([...attachments, ...Array.from(event.currentTarget.files)]);
          event.currentTarget.value = "";
        }} />
      </label>
      <button type="button" className="icon-action" aria-label={t.draw} title={t.draw} disabled={sending || attachments.length >= 4} onClick={() => setDrawing(true)}><Palette size={21} /></button>
      <button type="button" className="icon-action" aria-label={t.addPoll} title={t.addPoll} aria-pressed={poll !== null}
        disabled={sending} onClick={() => changePoll(poll ? null : initialPoll)}><ChartNoAxesColumn size={20} /></button>
      <button className="social-primary" disabled={sending || !ready}>{t.publish}<ArrowUpRight size={16} aria-hidden="true" /></button>
    </div>
    {drawing && <Drawing lang={lang} close={() => setDrawing(false)}
      attach={(file) => { attach([...attachments, file]); setDrawing(false); }} />}
  </form>;
}
