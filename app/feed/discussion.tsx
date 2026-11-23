"use client";
import { useRef, useState, type FormEvent } from "react";
import { Heart, Paperclip, Send } from "lucide-react";
import { api } from "../lib/api";
import { copy, type Lang } from "../lib/locale";
import { ContentDialog, targetsFor, type Mode } from "../ui/moderation";
import { LinkedText } from "../ui/mentions";
import { DraftAttachment, PostAttachments, fileAccept, validAttachments } from "./media-player";
import { AuthorLine, Avatar, PostImage } from "./posts";
import { errorText, publish, useFeed, type Post } from "./post-data";
type Order = "popular" | "recent" | "oldest";
export function Discussion({ postId, lang, onPublished, readOnly }: {
  postId: string; readOnly?: boolean; lang: Lang; onPublished: () => void;
}) {
  const site = copy[lang];
  const t = site.social;
  const mod=site.admin;
  const [moderation,setModeration]=useState<{mode:Mode; post:Post; own?:boolean} | null>(null);
  const [order, setOrder] = useState<Order>("popular");
  const thread = useFeed(`thread=${postId}&order=${order}`);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [liking, setLiking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [likeError, setLikeError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const draftId = useRef("");
  const date = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  function attach(files: File[]) {
    if (!validAttachments(files)) {
      setError(site.errors.post_media_invalid);
      return;
    }
    setError("");
    draftId.current = "";
    setAttachments(files);
  }
  function replyTo(username: string) {
    const mention = `@${username} `;
    if (!body.startsWith(mention) && mention.length + body.length <= 1000) {
      draftId.current = "";
      setBody(mention + body);
    }
    input.current?.focus();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || (!body.trim() && !attachments.length)) return;
    setSending(true);
    setError("");
    try {
      draftId.current ||= crypto.randomUUID();
      await publish(body, draftId.current, { reply: postId, media: attachments });
      draftId.current = "";
      setBody("");
      setAttachments([]);
      thread.reload();
      onPublished();
    } catch (cause) { setError(errorText(lang, cause)); }
    finally { setSending(false); }
  }
  async function toggleLike(id: string, liked: boolean) {
    if (liking) return;
    setLiking(id);
    setLikeError("");
    try {
      await api(`posts/${id}/like`, { enabled: !liked });
      thread.update(comment => comment.id === id
        ? { ...comment, liked: !liked, likes: comment.likes + (liked ? -1 : 1) }
        : comment);
    } catch (cause) { setLikeError(errorText(lang, cause)); }
    finally { setLiking(null); }
  }
  return <section className="discussion" id="comments" aria-labelledby="discussion-title">
    <header className="discussion-head">
      <h2 id="discussion-title">{t.comments}</h2>
      <select className="discussion-sort" aria-label={t.commentOrder} value={order}
        onChange={event => { setOrder(event.target.value as Order); setLikeError(""); }}>
        <option value="popular">{t.commentsPopular}</option>
        <option value="recent">{t.commentsRecent}</option>
        <option value="oldest">{t.commentsOldest}</option>
      </select>
    </header>
    {thread.error != null && <div className="discussion-state">
      <p role="alert">{errorText(lang, thread.error)}</p>
      <button type="button" className="social-secondary" onClick={thread.reload}>{t.retry}</button>
    </div>}
    {!thread.current && thread.error == null && <p className="discussion-state" role="status">{site.loading}</p>}
    {thread.current?.posts.length === 0 && <p className="discussion-state">{t.threadEmpty}</p>}
    {likeError && <p className="discussion-state social-error" role="alert">{likeError}</p>}
    {thread.current && thread.current.posts.length > 0 && <ul className="comment-list">
      {thread.current.posts.map(comment => {
        const created = new Date(comment.created_at * 1000);
        return <li key={comment.id} className="comment" id={`comment-${comment.id}`}>
          <Avatar source={comment.author.avatar ? `/api/avatars/${comment.author.id}` : undefined} />
          <div className="comment-content">
            <header><AuthorLine author={comment.author} lang={lang} />
              <time dateTime={created.toISOString()}>{date.format(created).toLowerCase()}</time></header>
            {comment.body && <p className="comment-body"><LinkedText value={comment.body} /></p>}
            {comment.image && <PostImage id={comment.id} label={t.imageAlt} />}
            <PostAttachments id={comment.id} media={comment.media ?? []} lang={lang} />
            {comment.deleted && <p className="removed-caption">{mod.deletedComment}</p>}
            {!comment.deleted && <footer>
              <button type="button" className="comment-reply" disabled={sending || readOnly}
                onClick={() => replyTo(comment.author.username)}>{t.reply}</button>
              <button type="button" className="reaction comment-like" aria-label={comment.liked ? t.unlikeComment : t.likeComment}
                aria-pressed={comment.liked} disabled={liking !== null || readOnly} onClick={() => void toggleLike(comment.id, comment.liked)}>
                <Heart size={16} aria-hidden="true" />{comment.likes}
              </button>
              {!comment.mine && <button type="button" className="comment-reply danger-action"
                onClick={() => setModeration({mode:"report",post:comment})}>{mod.fileReport}</button>}
              {(comment.can_delete || comment.can_moderate) && <button type="button" className="comment-reply danger-action"
                onClick={() => setModeration({mode:"remove",post:comment,own:!comment.can_moderate})}>{mod.remove}</button>}
            </footer>}
          </div>
        </li>;
      })}
    </ul>}
    {thread.current?.more && <div className="discussion-state">
      <button type="button" className="social-secondary" onClick={thread.more} disabled={thread.loadingMore}>{t.more}</button>
    </div>}
    {!readOnly && <form className="comment-composer" onSubmit={submit}>
      {attachments.length > 0 && <div className="draft-attachments">{attachments.map((file, index) =>
        <DraftAttachment key={`${index}-${file.name}`} file={file} lang={lang} disabled={sending}
          remove={() => attach(attachments.filter((_, position) => position !== index))} />)}</div>}
      {error && <p className="social-error" role="alert">{error}</p>}
      <div className="comment-input-row">
        <label className="icon-action attach-file" title={t.attach}>
          <Paperclip size={19} aria-hidden="true" />
          <input type="file" aria-label={t.attach} disabled={sending || attachments.length >= 4} accept={fileAccept} multiple
            onChange={event => {
              if (event.currentTarget.files?.length) attach([...attachments, ...Array.from(event.currentTarget.files)]);
              event.currentTarget.value = "";
            }} />
        </label>
        <textarea ref={input} rows={2} maxLength={1000} aria-label={t.commentPlaceholder} placeholder={t.commentPlaceholder}
          value={body} disabled={sending} onChange={event => {
            draftId.current = "";
            setBody(event.target.value);
          }} />
        <button className="social-primary comment-send" aria-label={t.sendComment} title={t.sendComment}
          disabled={sending || (!body.trim() && !attachments.length)}>
          <Send size={18} aria-hidden="true" />
        </button>
      </div>
    </form>}
    {moderation && <ContentDialog lang={lang} mode={moderation.mode} own={moderation.own}
      targets={moderation.own ? [{kind:"comment",id:moderation.post.id}] : targetsFor(moderation.post,true)}
      close={() => setModeration(null)} changed={() => { thread.reload(); onPublished(); }}/>}
  </section>;
}
