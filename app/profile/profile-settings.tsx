"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Bell, Link2, Palette, Shield, UserRound, Users } from "lucide-react";
import { api } from "../lib/api";
import { Dialog } from "../ui/dialog";
import { copy, type Lang } from "../lib/locale";
import { MentionField } from "../ui/mentions";
import { SecuritySettings } from "./security-settings";
import { PushSettings } from "./push-settings";
import { readableError, useResource, type Audience, type Blocked, type NoticePreference, type Owner, type Preferences, type ProfileView, type Theme } from "./profile-data";
const sections = { account: UserRound, aliases: Link2, appearance: Palette, security: Shield, privacy: Users, notifications: Bell };
type Section = keyof typeof sections;
const audiences: Audience[] = ["everyone", "followers", "nobody"];
const themes: Theme[] = ["dark", "light", "system"];
const noticeKeys = {
  all: "noticeAll", sound: "noticeSound", messages: "noticeMessage",
  follow: "noticeFollow", wall: "noticeWall", like: "noticeLike", reply: "noticeReply", mention: "noticeMention",
} as const;
export function ProfileSettings({ user, lang, close, saved, refreshProfile, themeChanged, deleted, revision }: {
  user: ProfileView; lang: Lang; close: () => void; saved: (profile: Owner) => void; refreshProfile: () => void;
  themeChanged: (theme: Theme) => void; deleted: () => void; revision: number;
}) {
  const site = copy[lang];
  const t = site.profiles;
  const social = site.social;
  const prefs = useResource<Preferences>("settings/preferences");
  const blockList = useResource<Blocked[]>("settings/blocked");
  const [section, setSection] = useState<Section>("account");
  const aliases = useResource<{ username: string; enabled: boolean }[]>(section === "aliases" ? "settings/usernames" : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [deleting, setDeleting] = useState(false);
  async function run(action: () => Promise<void>) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setFeedback("");
    try { await action(); setFeedback(t.saved); return true; }
    catch (cause) { setError(readableError(lang, cause)); return false; }
    finally { setBusy(false); }
  }
  function change(key: string, value: unknown) {
    void run(async () => {
      await api("settings/preferences", { key, value });
      if (key === "theme") themeChanged(value as Theme);
      prefs.reload();
      refreshProfile();
    });
  }
  function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get("password");
    void run(async () => { await api("settings/account/delete", { password }); deleted(); });
  }
  const preferences = prefs.data;
  return <Dialog title={t.settings} close={close} closeLabel={social.close} wide className="profile-settings-dialog">
    <div className="profile-settings">
      <nav aria-label={t.settings}>{(Object.keys(sections) as Section[]).map(key => {
        const Icon = sections[key];
        return <button type="button" key={key} aria-pressed={section === key} disabled={busy} onClick={() => {
          setSection(key); setError(""); setFeedback("");
        }}><Icon size={18} />{t[key]}</button>;
      })}</nav>
      <section className="settings-panel">
        <h3>{t[section]}</h3>
        {section === "account" && <>
          <AccountEditor user={user} revision={revision} lang={lang} busy={busy}
            onSave={form => run(async () => { saved(await api<Owner>("profile", form)); })} />
          <button type="button" className="social-secondary danger-action account-delete" disabled={busy}
            onClick={() => { setError(""); setDeleting(true); }}>{t.deleteAccount}</button>
        </>}
        {section === "aliases" && <div className="settings-stack">
          <p className="settings-feedback">{t.aliasesHint}</p>
          {aliases.error ? <div><p className="social-error" role="alert">{readableError(lang, aliases.error)}</p>
            <button type="button" className="social-secondary" onClick={aliases.reload}>{social.retry}</button></div>
            : !aliases.data ? <p role="status">{site.loading}</p>
            : !aliases.data.length ? <p className="settings-feedback">{t.aliasesEmpty}</p>
            : <ul className="session-list settings-alias-list">{aliases.data.map(alias => <li key={alias.username}>
              <div>{alias.enabled ? <Link href={`/${encodeURIComponent(alias.username)}`} onNavigate={close}>@{alias.username}</Link> : <span>@{alias.username}</span>}</div>
              <label className="settings-alias-toggle"><span>{alias.enabled ? t.aliasActive : t.aliasInactive}</span>
                <input type="checkbox" role="switch" aria-label={`@${alias.username}`} checked={alias.enabled} disabled={busy}
                  onChange={event => {
                    const enabled = event.target.checked;
                    void run(async () => {
                      await api("settings/usernames", { username: alias.username, enabled });
                      aliases.reload(); refreshProfile();
                    });
                  }} />
              </label>
            </li>)}</ul>}
        </div>}
        {section === "security" && <SecuritySettings lang={lang} />}
        {section !== "account" && section !== "aliases" && section !== "security" && (!preferences ? (
          prefs.error ? <div><p className="social-error" role="alert">{readableError(lang, prefs.error)}</p>
            <button type="button" className="social-secondary" onClick={prefs.reload}>{social.retry}</button></div> :
            <p role="status">{site.loading}</p>
        ) : section === "appearance" ? <label className="settings-row">
          <strong>{t.theme}</strong>
          <select value={preferences.theme} disabled={busy} onChange={event => change("theme", event.target.value)}>
            {themes.map(theme => <option key={theme} value={theme}>{t[theme]}</option>)}
          </select>
        </label> : section === "privacy" ? <div className="settings-stack">
          {([["wall_access", "wallAccess"], ["like_access", "likeAccess"], ["message_access", "messageAccess"]] as const).map(([key, label]) =>
            <label className="settings-row" key={key}><span>{t[label]}</span>
              <select value={preferences[key]} disabled={busy} onChange={event => change(key, event.target.value)}>
                {audiences.map(scope => <option key={scope} value={scope}>{t[scope]}</option>)}
              </select>
            </label>)}
          <label className="settings-row"><div><strong>{t.showOnline}</strong><p>{t.onlineHint}</p></div>
            <input type="checkbox" role="switch" checked={preferences.show_online} disabled={busy}
              onChange={event => change("show_online", event.target.checked)} />
          </label>
          <h4>{t.blocked}</h4>
          {blockList.error ? <div><p className="social-error" role="alert">{readableError(lang, blockList.error)}</p>
            <button type="button" className="social-secondary" onClick={blockList.reload}>{social.retry}</button></div>
            : !blockList.data ? <p role="status">{site.loading}</p>
            : blockList.data.length === 0 ? <p className="settings-feedback">{t.blockedEmpty}</p>
            : <ul className="session-list">{blockList.data.map(person => <li key={person.id}>
              <div><strong>{person.name}</strong><p>@{person.username}</p></div>
              <button type="button" className="social-secondary" disabled={busy} onClick={() => void run(async () => {
                await api(`accounts/${person.id}/block`, { enabled: false }); blockList.reload();
              })}>{t.unblock}</button>
            </li>)}</ul>}
        </div> : <div className="settings-stack"><PushSettings lang={lang} notificationsEnabled={preferences.notice_preferences.all !== false} />
          {(Object.keys(noticeKeys) as NoticePreference[]).map(kind =>
          <label className="settings-row" key={kind}><span>{t[noticeKeys[kind]]}</span>
            <input type="checkbox" role="switch" checked={preferences.notice_preferences[kind] ?? kind !== "sound"}
              disabled={busy || (kind !== "all" && preferences.notice_preferences.all === false)}
              onChange={event => change("notice", { kind, enabled: event.target.checked })} />
          </label>)}</div>)}
        {error && !deleting && <p className="social-error" role="alert">{error}</p>}
        {feedback && <p className="settings-feedback" role="status">{feedback}</p>}
      </section>
    </div>
    {deleting && <Dialog title={t.deleteAccount} close={() => setDeleting(false)} closeLabel={social.close}>
      <form className="settings-form" onSubmit={deleteAccount}>
        <p>{t.deleteAccountHint}</p>
        <label className="content-field">{t.currentPassword}
          <input name="password" type="password" autoComplete="current-password" required maxLength={512} />
        </label>
        {error && <p className="social-error" role="alert">{error}</p>}
        <div className="dialog-actions account-delete-actions">
          <button type="button" className="social-secondary" onClick={() => setDeleting(false)}>{social.cancel}</button>
          <button className="social-primary danger-action" disabled={busy}>{t.deleteAccount}</button>
        </div>
      </form>
    </Dialog>}
  </Dialog>;
}
function AccountEditor({ user, revision, lang, busy, onSave }: {
  user: ProfileView; revision: number; lang: Lang; busy: boolean; onSave: (form: FormData) => Promise<boolean>;
}) {
  const t = copy[lang].profiles;
  const [bio, setBio] = useState(user.bio);
  const [file, setFile] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const source = preview || (!remove && user.avatar ? `/api/avatars/${user.id}?v=${revision}` : "");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (file) form.set("avatar", file);
    if (remove) form.set("remove_avatar", "true");
    if (await onSave(form)) { setFile(null); setRemove(false); }
  }
  return <form className="settings-stack" onSubmit={submit}>
    <div className="settings-row settings-avatar">
      <span className="social-avatar">{source ? <img src={source} alt="" /> : <UserRound size={25} />}</span>
      <div><strong>{t.avatar}</strong>
        <label className="social-secondary settings-file">{t.changeAvatar}
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => {
            if (event.target.files?.[0]) { setFile(event.target.files[0]); setRemove(false); }
            event.target.value = "";
          }} />
        </label>
        {source && <button type="button" className="social-secondary danger-action" disabled={busy}
          onClick={() => { setFile(null); setRemove(true); }}>{t.removeAvatar}</button>}
      </div>
    </div>
    <label className="settings-row">{t.name}<input name="name" defaultValue={user.name} maxLength={80} required disabled={busy} /></label>
    <label className="settings-row">{t.username}<input name="username" defaultValue={user.username} minLength={3} maxLength={54} required disabled={busy} /></label>
    <MentionField className="content-field" lang={lang} label={t.bio} name="bio"
      value={bio} onChange={setBio} maxLength={500} rows={4} disabled={busy} />
    <button className="social-primary" disabled={busy}>{t.save}</button>
  </form>;
}
