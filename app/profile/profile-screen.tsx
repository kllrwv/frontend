"use client";
import { Fragment, useRef, useState } from "react";
import { Brush, Ellipsis, ImagePlus, Pencil, ShieldBan, Trash2, UserRound } from "lucide-react";
import { api } from "../lib/api";
import { Dialog } from "../ui/dialog";
import { ContentDialog, type Access, type Mode, type Target } from "../ui/moderation";
import { NameWithBadge } from "../ui/verified";
import { Drawing } from "../feed/drawing";
import { copy, type Lang } from "../lib/locale";
import { LinkedText } from "../ui/mentions";
import { ProfileConnections } from "./profile-connections";
import { connectionCount, readableError, type ConnectionDirection, type ProfileView } from "./profile-data";
export function ProfileHead({ data, lang, revision, edit, changed, blocked, access }: {
  data: ProfileView; lang: Lang; revision: number; edit: () => void; changed: () => void; blocked: () => void; access?: Access;
}) {
  const t = copy[lang].profiles;
  const social = copy[lang].social;
  const mod = copy[lang].admin;
  const [moderation,setModeration] = useState<Mode | null>(null);
  const mediaTargets: Target[] = [
    ...(data.avatar ? [{kind:"avatar" as const,id:data.id}] : []),
    ...(data.banner ? [{kind:"banner" as const,id:data.id}] : []),
  ];
  const input = useRef<HTMLInputElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [connections, setConnections] = useState<ConnectionDirection | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const number = new Intl.NumberFormat(lang);
  const joined = new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric" }).format(data.joined * 1000).toLowerCase();
  const presence = data.last_seen === null ? null :
    Date.now() - data.last_seen * 1000 < 150_000 ? t.online :
      t.seen.replace("{date}", new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" }).format(data.last_seen * 1000).toLowerCase());
  async function perform(action: () => Promise<unknown>, done = changed) {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await action(); done(); }
    catch (cause) { setError(readableError(lang, cause)); }
    finally { setBusy(false); }
  }
  function upload(file: File) {
    const form = new FormData();
    form.set("banner", file);
    return perform(() => api("profile/banner", form));
  }
  return <header className="profile-overview">
    <div className="profile-banner">
      {data.banner && <img src={`/api/accounts/${data.id}/banner?v=${data.banner}`} alt={t.banner} />}
      {data.mine && <details className="post-menu banner-menu">
        <summary className="icon-action" aria-label={t.banner}><ImagePlus size={20} /></summary>
        <div>
          <button type="button" disabled={busy} onClick={event => {
            event.currentTarget.closest("details")?.removeAttribute("open");
            input.current?.click();
          }}><ImagePlus size={17} />{t.uploadBanner}</button>
          <button type="button" disabled={busy} onClick={event => {
            event.currentTarget.closest("details")?.removeAttribute("open");
            setDrawing(true);
          }}><Brush size={17} />{t.drawBanner}</button>
          {data.banner && <button type="button" className="danger-action" disabled={busy} onClick={event => {
            event.currentTarget.closest("details")?.removeAttribute("open");
            void perform(() => api("profile/banner/remove", {}));
          }}><Trash2 size={17} />{t.removeBanner}</button>}
        </div>
      </details>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void upload(file);
      }} />
    </div>
    <div className="profile-identity">
      <span className="social-avatar profile-avatar">
        {data.avatar ? <img src={`/api/avatars/${data.id}?v=${revision}`} alt="" /> : <UserRound size={34} />}
      </span>
      <div className="profile-actions">
        {data.mine ? <button type="button" className="social-secondary" onClick={edit}><Pencil size={16} />{t.edit}</button> : !data.deleted && <>
          <button type="button" className={data.followed ? "social-secondary" : "social-primary"} disabled={busy}
            onClick={() => void perform(() => api(`accounts/${data.id}/follow`, { enabled: !data.followed }))}>
            {data.followed ? social.unfollow : social.follow}
          </button>
          <details className="post-menu">
            <summary className="icon-action" aria-label={t.profileMenu}><Ellipsis size={20} /></summary>
            <div><button type="button" className="danger-action" onClick={event => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              setConfirm(true);
            }}><ShieldBan size={17} />{t.block}</button>
              <button type="button" className="danger-action" onClick={event => {
                event.currentTarget.closest("details")?.removeAttribute("open"); setModeration("report");
              }}>{mod.fileReport}</button>
              {(access?.manage_accounts || access?.moderate && mediaTargets.length>0) &&
                <button type="button" className="danger-action" onClick={event => {
                  event.currentTarget.closest("details")?.removeAttribute("open"); setModeration("remove");
                }}>{mod.moderate}</button>}
            </div>
          </details>
        </>}
      </div>
    </div>
    <h1>{data.verified ? <NameWithBadge name={data.name} lang={lang} size={24} /> : data.name}</h1>
    <p className="profile-handle">
      <span>@{data.username}</span>
      {!!data.aliases?.length && <>, {t.aliasesAlso}{" "}{data.aliases.map((alias, index) => (
        <Fragment key={alias}>{index > 0 && ", "}<span>@{alias}</span></Fragment>
      ))}</>}
    </p>
    {data.bio && <p className="profile-bio"><LinkedText value={data.bio} /></p>}
    <div className="profile-facts">
      {(["followers", "following"] as const).map(direction => {
        const count = data[direction];
        const label = <><strong>{number.format(count)}</strong>{" "}{connectionCount(lang, direction, count)}</>;
        return data.deleted ? <span key={direction} className="profile-count">{label}</span> :
          <button key={direction} type="button" className="profile-count" aria-haspopup="dialog" onClick={() => setConnections(direction)}>{label}</button>;
      })}
    </div>
    <p className="profile-dates">{t.joined.replace("{date}", joined)}{presence && <span>{presence}</span>}</p>
    {data.deleted && <p className="removed-caption">{mod.deletedAccount}</p>}
    {moderation && <ContentDialog targets={[
      ...(moderation === "report" || access?.manage_accounts ? [{kind:"account" as const,id:data.id}] : []),
      ...(moderation === "report" || access?.moderate ? mediaTargets : []),
    ]} lang={lang} mode={moderation} close={() => setModeration(null)} changed={changed}/>}
    {error && <p className="social-error" role="alert">{error}</p>}
    {connections && <ProfileConnections accountId={data.id} direction={connections} lang={lang}
      close={() => setConnections(null)} changed={changed} />}
    {drawing && <Drawing lang={lang} banner close={() => setDrawing(false)} attach={file => {
      setDrawing(false);
      void upload(file);
    }} />}
    {confirm && <Dialog title={t.confirmBlock} close={() => setConfirm(false)} closeLabel={social.close}>
      {error && <p className="social-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="social-secondary" onClick={() => setConfirm(false)}>{social.cancel}</button>
        <button type="button" className="social-primary danger-action" disabled={busy}
          onClick={() => void perform(() => api(`accounts/${data.id}/block`, { enabled: true }), blocked)}>{t.block}</button>
      </div>
    </Dialog>}
  </header>;
}
