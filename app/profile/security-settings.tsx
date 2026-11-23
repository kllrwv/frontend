"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Monitor, X } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { copy, type Lang } from "../lib/locale";
import { readableError, useResource } from "./profile-data";
import { AuthenticatorSettings } from "./authenticator-settings";
type Device = { id: string; device: string | null; last_seen: number; current: boolean };
type Security = {
  email: string | null; phone_tail: string | null; phone_linked?: boolean; telegram_linked?: boolean;
  totp_enabled: boolean; sessions: Device[];
};
type Mode = "email" | "phone" | "password";
type Challenge = { kind: "email" | "phone"; id: string; url?: string };
export function SecuritySettings({ lang }: { lang: Lang }) {
  const site = copy[lang];
  const t = site.profiles;
  const social = site.social;
  const info = useResource<Security>("settings/security");
  const [mode, setMode] = useState<Mode | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const reload = info.reload;
  useEffect(() => {
    if (challenge?.kind !== "phone") return;
    const challengeId = challenge.id;
    const request = new AbortController();
    let timer = 0;
    function stop(errorText?: string) {
      setChallenge(null);
      setMode(null);
      setSaved(!errorText);
      if (errorText) setError(errorText);
      else reload();
    }
    async function check() {
      try {
        const state = await api<{ result: null | "done" | "contact_unavailable" }>(
          `settings/phone/${challengeId}`, undefined, request.signal);
        if (request.signal.aborted) return;
        if (state.result === "done") { stop(); return; }
        if (state.result === "contact_unavailable") { stop(site.errors.contact_unavailable); return; }
      } catch (cause) {
        if (request.signal.aborted) return;
        if (cause instanceof ApiError && cause.message === "expired") { stop(readableError(lang, cause)); return; }
      }
      timer = window.setTimeout(check, 2000);
    }
    void check();
    return () => { request.abort(); window.clearTimeout(timer); };
  }, [challenge, lang, reload, site.errors.contact_unavailable]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try { await action(); }
    catch (cause) { setError(readableError(lang, cause)); }
    finally { setBusy(false); }
  }
  function done() {
    setChallenge(null);
    setMode(null);
    setSaved(true);
    reload();
  }
  function closeForm() {
    void run(async () => {
      if (challenge) await api(`settings/contact/${challenge.id}/cancel`, {});
      setChallenge(null);
      setMode(null);
    });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    void run(async () => {
      if (challenge?.kind === "email") {
        await api("settings/email/verify", { id: challenge.id, code: form.code });
        done();
      } else if (mode === "email") {
        const ticket = await api<{ id: string }>("settings/email", { ...form, lang });
        setChallenge({ kind: "email", ...ticket });
      } else if (mode === "phone") {
        const ticket = await api<{ id: string; url: string }>("settings/phone", { password: form.password });
        setChallenge({ kind: "phone", ...ticket });
      } else if (mode === "password") {
        await api("settings/password", form);
        done();
      }
    });
  }
  function revoke(id?: string) {
    void run(async () => { await api("settings/sessions/revoke", { id: id ?? null }); reload(); setSaved(true); });
  }
  if (info.error) return <div className="settings-stack">
    <p role="alert" className="social-error">{readableError(lang, info.error)}</p>
    <button type="button" className="social-secondary" onClick={reload}>{social.retry}</button>
  </div>;
  if (!info.data) return <p role="status">{site.loading}</p>;
  const date = new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" });
  const phone = info.data.phone_tail ? `•••• ${info.data.phone_tail}` :
    info.data.phone_linked === false ? t.contactNotLinked : t.phoneLinked;
  const rows = [
    { kind: "phone", label: t.phone, value: phone, action: t.changePhone },
    { kind: "email", label: t.email, value: info.data.email ?? t.contactNotLinked, action: t.changeEmail },
    { kind: "password", label: t.password, value: null, action: t.changePassword },
  ] as const;
  return <div className="settings-stack">
    {rows.map(row => <div className="settings-row" key={row.kind}>
      <div><strong>{row.label}</strong>{row.value && <p>{row.value}</p>}</div>
      {(row.kind !== "phone" || info.data?.telegram_linked !== false) && <button type="button" className="social-secondary" disabled={busy || mode !== null}
        onClick={() => { setMode(row.kind); setSaved(false); setError(""); }}>{row.action}</button>}
    </div>)}
    {mode && <form className="settings-form" key={challenge?.kind ?? mode} onSubmit={submit}>
      {challenge?.kind === "phone" ? <>
        <p>{t.waitPhone}</p>
        <a className="social-primary no-underline" href={challenge.url} target="_blank" rel="noopener noreferrer">{t.openTelegram}</a>
      </> : <>
        {challenge?.kind === "email" ? <label className="content-field">{t.emailCode}
          <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" />
        </label> : <>
          <label className="content-field">{t.currentPassword}<input type="password" name="password" required autoComplete="current-password" maxLength={512} /></label>
          {mode === "email" && <label className="content-field">{t.newEmail}<input type="email" name="email" required autoComplete="email" /></label>}
          {mode === "password" && <>
            <label className="content-field">{t.newPassword}<input type="password" name="new_password" required minLength={10} maxLength={512} autoComplete="new-password" /></label>
            <label className="content-field">{t.repeatPassword}<input type="password" name="confirmation" required minLength={10} maxLength={512} autoComplete="new-password" /></label>
          </>}
          {mode !== "password" && <p>{t.retireContact}</p>}
        </>}
        <button className="social-primary" disabled={busy}>{mode === "email" && !challenge ? t.sendCode : t.confirm}</button>
      </>}
      <button type="button" className="social-secondary" onClick={closeForm} disabled={busy}>{social.cancel}</button>
    </form>}
    {error && <p className="social-error" role="alert">{error}</p>}
    {saved && <p role="status" className="settings-feedback">{t.saved}</p>}
    <AuthenticatorSettings lang={lang} enabled={info.data.totp_enabled} reload={reload} />
    <h4>{t.sessions}</h4>
    <ul className="session-list">{info.data.sessions.map(device => <li key={device.id}>
      <Monitor size={20} aria-hidden="true" />
      <div><strong>{device.device?.toLowerCase() ?? t.unknownDevice}</strong><p>{date.format(device.last_seen * 1000).toLowerCase()}</p></div>
      {device.current ? <small>{t.currentSession}</small> : <button type="button" className="icon-action danger-action"
        aria-label={t.revokeOne} disabled={busy} onClick={() => revoke(device.id)}><X size={17} /></button>}
    </li>)}</ul>
    {info.data.sessions.some(device => !device.current) && <button type="button" className="social-secondary danger-action"
      disabled={busy} onClick={() => revoke()}>{t.revokeOthers}</button>}
  </div>;
}
